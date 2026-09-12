import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  assertCanScan,
  fetchUserPlan,
  fetchUserStatsData,
  incrementScanCount,
} from '../_shared/planQuotas.ts';
import {
  isReasoningVisionModel,
  scanImageDetail,
  scanReasoningEffort,
} from '../_shared/openaiModels.ts';
import {
  selectScanSystemPrompt,
  SCANPLAY_EXTRACT_JSON_SCHEMA,
  buildScanUserPrompt,
} from '../_shared/scanPrompt.ts';
import {
  buildFullRecountHint,
  buildScanChannelPrompt,
  needsFullRecount,
  normalizeScanPlatform,
  resolveScanChannel,
  type ScanChannel,
} from '../_shared/scanChannels.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeBody {
  imageBase64?: string;
  mimeType?: string;
  sheetType?: string;
  /** Ignored for quotas — plan comes from Supabase profile only. */
  maxPairs?: number;
  /** Client device channel: ios | android | windows | other */
  platform?: string;
}

interface ExtractPair {
  term?: string;
  definition?: string;
  faces?: string[];
  termLang?: string;
  defLang?: string;
  confidence?: string;
}

interface ExtractPayload {
  readable?: boolean;
  sheetType?: string;
  detectedLangs?: string[];
  pairs?: ExtractPair[];
  warnings?: string[];
}

/** Headroom for JSON pairs — keep modest to limit cost; recount covers thin extracts. */
function outputBudget(sheetType: string, maxPairs: number, reasoning: boolean): number {
  if (sheetType === 'math') return reasoning ? 14000 : 10000;
  const capped = Math.min(maxPairs, 80);
  const perPair = reasoning ? 100 : 80;
  const base = reasoning ? 4000 : 2500;
  const scaled = Math.min(24000, base + capped * perPair);
  if (sheetType === 'notes' || sheetType === 'definitions') {
    return Math.max(reasoning ? 10000 : 8000, scaled);
  }
  return Math.max(reasoning ? 8000 : 5000, scaled);
}

function buildOpenAiBody(
  channel: ScanChannel,
  sheetType: string,
  imageBase64: string,
  mimeType: string,
  imageDetail: 'high' | 'original',
  extraUserText?: string,
) {
  const userPrompt = [
    buildScanChannelPrompt(channel),
    buildScanUserPrompt(sheetType, channel.maxPairs, channel.plan),
    extraUserText ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const reasoning = isReasoningVisionModel(channel.model);
  const body: Record<string, unknown> = {
    model: channel.model,
    response_format: {
      type: 'json_schema',
      json_schema: SCANPLAY_EXTRACT_JSON_SCHEMA,
    },
    messages: [
      { role: 'system', content: selectScanSystemPrompt(sheetType) },
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
    body.max_completion_tokens = outputBudget(sheetType, channel.maxPairs, true);
    body.reasoning_effort = scanReasoningEffort(sheetType);
  } else {
    body.temperature = 0.1;
    body.max_tokens = outputBudget(sheetType, channel.maxPairs, false);
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

function asExtractPayload(parsed: unknown): ExtractPayload | null {
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed as ExtractPayload;
}

function normalizePairKey(term: unknown, definition: unknown): string {
  return `${String(term ?? '').toLowerCase().trim()}\t${String(definition ?? '').toLowerCase().trim()}`;
}

function mergeExtractPayloads(primary: ExtractPayload, extra: ExtractPayload, maxPairs: number): ExtractPayload {
  const outPairs: ExtractPair[] = [];
  const seen = new Set<string>();
  for (const p of [...(primary.pairs ?? []), ...(extra.pairs ?? [])]) {
    if (!p || typeof p.term !== 'string' || typeof p.definition !== 'string') continue;
    const key = normalizePairKey(p.term, p.definition);
    const termKey = p.term.toLowerCase().trim();
    if (!termKey || seen.has(termKey)) continue;
    seen.add(termKey);
    seen.add(key);
    outPairs.push(p);
    if (outPairs.length >= maxPairs) break;
  }
  const warnings = [
    ...(Array.isArray(primary.warnings) ? primary.warnings.filter((w) => typeof w === 'string') : []),
    ...(Array.isArray(extra.warnings) ? extra.warnings.filter((w) => typeof w === 'string') : []),
  ];
  if (outPairs.length > (primary.pairs?.length ?? 0)) {
    warnings.push('extraction_recounted');
  }
  return {
    readable: Boolean(primary.readable || extra.readable),
    sheetType: primary.sheetType ?? extra.sheetType,
    detectedLangs: Array.isArray(primary.detectedLangs) && primary.detectedLangs.length
      ? primary.detectedLangs
      : extra.detectedLangs,
    pairs: outPairs,
    warnings,
  };
}

/** Prefer the longer complete recount when the second pass re-lists everything. */
function pickRicherPayload(a: ExtractPayload, b: ExtractPayload, maxPairs: number): ExtractPayload {
  const merged = mergeExtractPayloads(a, b, maxPairs);
  const aLen = a.pairs?.length ?? 0;
  const bLen = b.pairs?.length ?? 0;
  if (merged.pairs && merged.pairs.length >= Math.max(aLen, bLen)) return merged;
  return bLen > aLen ? { ...b, pairs: (b.pairs ?? []).slice(0, maxPairs) } : a;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'analysis_unavailable' }), {
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
    const { imageBase64, mimeType = 'image/jpeg', sheetType = 'vocab' } = body;
    const platform = normalizeScanPlatform(body.platform);
    const channel = resolveScanChannel(plan, platform);

    // Image stays in this request only. It is not written to Storage or the database.

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'imageBase64 required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.info('[analyze-sheet]', {
      userId: user.id,
      channel: channel.label,
      sheetType,
    });

    const firstDetail = scanImageDetail(channel.model);
    let openaiCall = await requestOpenAi(
      openaiKey,
      buildOpenAiBody(channel, sheetType, imageBase64, mimeType, firstDetail),
    );

    if (!openaiCall.ok && firstDetail === 'original' && shouldRetryWithoutOriginal(openaiCall.text)) {
      openaiCall = await requestOpenAi(
        openaiKey,
        buildOpenAiBody(channel, sheetType, imageBase64, mimeType, 'high'),
      );
    }

    if (!openaiCall.ok) {
      console.error('analyze-sheet upstream failed', openaiCall.status, channel.label);
      return new Response(JSON.stringify({ error: 'analysis_failed' }), {
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
      return new Response(JSON.stringify({ error: 'analysis_failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const content = openaiJson?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'analysis_failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: 'analysis_failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let payload = asExtractPayload(parsed);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'analysis_failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const finishReason = openaiJson?.choices?.[0]?.finish_reason;
    if (finishReason === 'length') {
      const warnings = Array.isArray(payload.warnings)
        ? payload.warnings.filter((w) => typeof w === 'string')
        : [];
      warnings.push('extraction_truncated');
      payload.warnings = warnings;
    }

    let pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
    let pass = 0;
    const maxRecountPasses = 1;
    while (
      pass < maxRecountPasses &&
      needsFullRecount(sheetType, pairs.length, channel.maxPairs, pass === 0 ? finishReason : undefined)
    ) {
      pass += 1;
      const contDetail = firstDetail === 'original' ? 'high' : firstDetail;
      const contCall = await requestOpenAi(
        openaiKey,
        buildOpenAiBody(
          channel,
          sheetType,
          imageBase64,
          mimeType,
          contDetail,
          buildFullRecountHint(sheetType, pairs, channel.maxPairs),
        ),
      );
      if (!contCall.ok) break;
      try {
        const contJson = JSON.parse(contCall.text) as typeof openaiJson;
        const contContent = contJson?.choices?.[0]?.message?.content;
        if (typeof contContent !== 'string') break;
        const contParsed = asExtractPayload(JSON.parse(contContent));
        if (!contParsed) break;
        payload = pickRicherPayload(payload, contParsed, channel.maxPairs);
        pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
        console.info('[analyze-sheet-recount]', {
          channel: channel.label,
          pass,
          pairs: pairs.length,
        });
      } catch {
        break;
      }
    }

    if (Array.isArray(payload.pairs) && payload.pairs.length > channel.maxPairs) {
      payload.pairs = payload.pairs.slice(0, channel.maxPairs);
    }

    if (supabaseAdmin) {
      await incrementScanCount(supabaseAdmin, user.id);
    }

    return new Response(JSON.stringify(payload), {
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
