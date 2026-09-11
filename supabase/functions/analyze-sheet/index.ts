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
  if (sheetType === 'math') return 16000;
  /* faces[] + langs inflate each pair; 90 was too tight and truncated dense vocab (~5 cards). */
  const scaled = Math.min(32000, 4500 + maxPairs * 160);
  if (sheetType === 'notes' || sheetType === 'definitions') {
    return Math.max(14000, scaled);
  }
  return scaled;
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

type RawPair = {
  term?: unknown;
  definition?: unknown;
  faces?: unknown;
  termLang?: unknown;
  defLang?: unknown;
  confidence?: unknown;
};

function readPairs(parsed: unknown): RawPair[] {
  if (!parsed || typeof parsed !== 'object') return [];
  const pairs = (parsed as { pairs?: unknown }).pairs;
  if (!Array.isArray(pairs)) return [];
  return pairs.filter(
    (p): p is RawPair =>
      typeof p === 'object' &&
      p !== null &&
      typeof (p as RawPair).term === 'string' &&
      typeof (p as RawPair).definition === 'string',
  );
}

function pairKey(p: RawPair): string {
  return `${String(p.term).trim().toLowerCase()}\t${String(p.definition).trim().toLowerCase()}`;
}

function mergeExtractResults(
  primary: Record<string, unknown>,
  extra: Record<string, unknown>,
  maxPairs: number,
): Record<string, unknown> {
  const seen = new Set<string>();
  const merged: RawPair[] = [];
  for (const p of [...readPairs(primary), ...readPairs(extra)]) {
    const key = pairKey(p);
    if (!key.trim() || seen.has(key)) continue;
    seen.add(key);
    merged.push(p);
    if (merged.length >= maxPairs) break;
  }
  const warnings = [
    ...(Array.isArray(primary.warnings) ? primary.warnings.filter((w) => typeof w === 'string') : []),
    ...(Array.isArray(extra.warnings) ? extra.warnings.filter((w) => typeof w === 'string') : []),
    'extraction_continued',
  ];
  return {
    ...primary,
    pairs: merged,
    warnings,
    readable: merged.length >= 2 ? true : primary.readable,
  };
}

function buildContinueOpenAiBody(
  model: string,
  sheetType: string,
  maxPairs: number,
  imageBase64: string,
  mimeType: string,
  imageDetail: 'high' | 'original',
  already: RawPair[],
) {
  const remaining = Math.max(4, maxPairs - already.length);
  const listed = already
    .slice(0, 60)
    .map((p) => `- ${String(p.term)} → ${String(p.definition)}`)
    .join('\n');
  const userPrompt = `CONTINUE l'extraction ScanPlay sur LA MÊME photo (fiche ${sheetType}).

Déjà extrait (${already.length} paires) — NE PAS les répéter :
${listed || '(aucune)'}

Tâche : extraire UNIQUEMENT les paires ENCORE MANQUANTES (autres colonnes, autres blocs, autres lignes), jusqu'à ${remaining} nouvelles paires.
Parcours toute la page : listes côte à côte, tableaux, bas de page.
Même JSON strict (readable, sheetType, detectedLangs, pairs, warnings). faces: [] si carte classique.`;

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
    body.max_completion_tokens = outputBudget(sheetType, remaining);
    body.reasoning_effort = scanReasoningEffort(sheetType);
  } else {
    body.temperature = 0.1;
    body.max_tokens = outputBudget(sheetType, remaining);
  }
  return body;
}

function parseOpenAiContent(openaiCallText: string): {
  ok: boolean;
  finishReason?: string;
  parsed?: Record<string, unknown>;
} {
  let openaiJson: {
    choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
  };
  try {
    openaiJson = JSON.parse(openaiCallText) as typeof openaiJson;
  } catch {
    return { ok: false };
  }
  const content = openaiJson?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') return { ok: false };
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return {
      ok: true,
      finishReason: openaiJson?.choices?.[0]?.finish_reason,
      parsed,
    };
  } catch {
    return { ok: false, finishReason: openaiJson?.choices?.[0]?.finish_reason };
  }
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

    // Image stays in this request only. It is not written to Storage or the database.

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(JSON.stringify({ error: 'imageBase64 required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const planCap = PLAN_LIMITS[plan].maxWords;
    const maxPairs = planCap;

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
      console.error('analyze-sheet upstream failed', openaiCall.status);
      return new Response(JSON.stringify({ error: 'analysis_failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let first = parseOpenAiContent(openaiCall.text);
    if (!first.ok || !first.parsed) {
      /* Truncated JSON often fails parse — one full retry with same image. */
      openaiCall = await requestOpenAi(
        openaiKey,
        buildOpenAiBody(model, sheetType, maxPairs, imageBase64, mimeType, firstDetail === 'original' ? 'high' : firstDetail),
      );
      if (!openaiCall.ok) {
        return new Response(JSON.stringify({ error: 'analysis_failed' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      first = parseOpenAiContent(openaiCall.text);
      if (!first.ok || !first.parsed) {
        return new Response(JSON.stringify({ error: 'analysis_failed' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let parsed = first.parsed;
    const firstPairs = readPairs(parsed);
    const thin =
      first.finishReason === 'length' ||
      (sheetType === 'vocab' && firstPairs.length > 0 && firstPairs.length < Math.min(maxPairs, 14));

    if (thin && firstPairs.length < maxPairs) {
      const detail = firstDetail === 'original' ? 'high' : firstDetail;
      const cont = await requestOpenAi(
        openaiKey,
        buildContinueOpenAiBody(
          model,
          sheetType,
          maxPairs,
          imageBase64,
          mimeType,
          detail,
          firstPairs,
        ),
      );
      if (cont.ok) {
        const second = parseOpenAiContent(cont.text);
        if (second.ok && second.parsed) {
          parsed = mergeExtractResults(parsed, second.parsed, maxPairs);
        }
      }
    }

    if (first.finishReason === 'length' && parsed && typeof parsed === 'object') {
      const rec = parsed;
      const warnings = Array.isArray(rec.warnings)
        ? rec.warnings.filter((w) => typeof w === 'string')
        : [];
      if (!warnings.includes('extraction_truncated')) warnings.push('extraction_truncated');
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
