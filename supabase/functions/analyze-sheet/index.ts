import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  assertCanScan,
  fetchUserPlan,
  fetchUserStatsData,
  incrementScanCount,
  PLAN_LIMITS,
} from '../_shared/planQuotas.ts';
import { resolveScanModel } from '../_shared/openaiModels.ts';
import { SCANPLAY_AI_SYSTEM_PROMPT, buildScanUserPrompt } from '../_shared/scanPrompt.ts';

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
    const statsData = supabaseAdmin
      ? await fetchUserStatsData(supabaseAdmin, user.id)
      : {};
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
    const userPrompt = buildScanUserPrompt(sheetType, maxPairs);
    const scientificSheet = sheetType === 'math' || sheetType === 'notes' || sheetType === 'definitions';
    const vocabTokens = Math.min(16000, 800 + maxPairs * 80);

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: resolveScanModel(),
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: scientificSheet ? 4000 : vocabTokens,
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
                  detail: 'high',
                },
              },
            ],
          },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(JSON.stringify({ error: 'OpenAI request failed', detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiJson = await openaiRes.json();
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
