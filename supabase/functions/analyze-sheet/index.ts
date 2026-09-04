import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  assertCanScan,
  fetchUserPlan,
  fetchUserStatsData,
  incrementScanCount,
  PLAN_LIMITS,
} from '../_shared/planQuotas.ts';
import {
  isReasoningVisionModel,
  resolveScanModel,
  scanImageDetail,
  scanReasoningEffort,
} from '../_shared/openaiModels.ts';
import {
  SCANPLAY_AI_SYSTEM_PROMPT,
  SCANPLAY_EXTRACT_JSON_SCHEMA,
  buildScanUserPrompt,
} from '../_shared/scanPrompt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeBody {
  imageBase64?: string;
  mimeType?: string;
  sheetType?: string;
  maxPairs?: number;
}

function outputBudget(sheetType: string, maxPairs: number): number {
  const scientific = sheetType === 'math' || sheetType === 'notes' || sheetType === 'definitions';
  if (scientific) return 12000;
  return Math.min(32000, 2000 + maxPairs * 90);
}

function buildOpenAiBody(
  model: string,
  sheetType: string,
  maxPairs: number,
  imageBase64: string,
  mimeType: string,
  imageDetail: 'high' | 'original',
) {
  const userPrompt = buildScanUserPrompt(sheetType, maxPairs);
  const reasoning = isReasoningVisionModel(model);
  const body: Record<string, unknown> = {
    model,
    response_format: {
      type: 'json_schema',
      json_schema: SCANPLAY_EXTRACT_JSON_SCHEMA,
    },
    messages: [
      { role: 'system', content: SCANPLAY_AI_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: imageDetail,
            },
          },
        ],
      },
    ],
  };

  if (reasoning) {
    body.max_completion_tokens = outputBudget(sheetType, maxPairs);
    body.reasoning_effort = scanReasoningEffort(sheetType);
  } else {
    body.temperature = 0.1;
    body.max_tokens = outputBudget(sheetType, maxPairs);
  }

  return body;
}

async function requestOpenAi(
  openaiKey: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; text: string }> {
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await openaiRes.text();
  return { ok: openaiRes.ok, status: openaiRes.status, text };
}

function shouldRetryWithoutOriginal(errText: string): boolean {
  const lower = errText.toLowerCase();
  return (
    lower.includes('image_url.detail') ||
    lower.includes("'original'") ||
    lower.includes('"original"') ||
    (lower.includes('detail') && lower.includes('invalid'))
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null;

    const plan = await fetchUserPlan(supabase, user.id);
    const statsData = supabaseAdmin ? await fetchUserStatsData(supabaseAdmin, user.id) : {};
    const scanQuotaError = assertCanScan(plan, statsData);
    if (scanQuotaError) {
      return new Response(JSON.stringify({ error: scanQuotaError }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as AnalyzeBody;
    const { imageBase64, mimeType = 'image/jpeg', sheetType = 'vocab', maxPairs: requestedMax } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'imageBase64 required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const planCap = PLAN_LIMITS[plan].maxWords;
    const maxPairs = Math.min(
      planCap,
      Math.max(4, Number.isFinite(Number(requestedMax)) ? Number(requestedMax) : planCap),
    );

    const model = resolveScanModel(plan);
    const firstDetail = scanImageDetail(model);
    let openaiCall = await requestOpenAi(
      openaiKey,
      buildOpenAiBody(model, sheetType, maxPairs, imageBase64, mimeType, firstDetail),
    );

    if (!openaiCall.ok && firstDetail === 'original' && shouldRetryWithoutOriginal(openaiCall.text)) {
      openaiCall = await requestOpenAi(
        openaiKey,
        buildOpenAiBody(model, sheetType, maxPairs, imageBase64, mimeType, 'high'),
      );
    }

    if (!openaiCall.ok) {
      return new Response(JSON.stringify({ error: 'OpenAI request failed', detail: openaiCall.text }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let openaiJson: {
      choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
    };
    try {
      openaiJson = JSON.parse(openaiCall.text) as typeof openaiJson;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid OpenAI envelope' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const content = openaiJson?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Empty OpenAI response' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON from OpenAI', raw: content }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (
      openaiJson?.choices?.[0]?.finish_reason === 'length' &&
      parsed &&
      typeof parsed === 'object'
    ) {
      const rec = parsed as Record<string, unknown>;
      const warnings = Array.isArray(rec.warnings) ? rec.warnings.filter((w) => typeof w === 'string') : [];
      warnings.push('extraction_truncated');
      rec.warnings = warnings;
    }

    if (supabaseAdmin) {
      await incrementScanCount(supabaseAdmin, user.id);
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
