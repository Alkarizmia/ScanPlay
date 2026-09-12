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
import {
  runGoogleVisionOcr,
  visionOcrIsStrong,
  type VisionOcrPair,
} from '../_shared/googleVision.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeBody {
  imageBase64?: string;
  mimeType?: string;
  sheetType?: string;
  maxPairs?: number;
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

function outputBudget(sheetType: string, maxPairs: number, reasoning: boolean, light: boolean): number {
  if (light) return Math.min(8000, 1800 + Math.min(maxPairs, 40) * 60);
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
  imageBase64: string | null,
  mimeType: string,
  imageDetail: 'low' | 'high' | 'original',
  extraUserText?: string,
  light = false,
) {
  const userPrompt = [
    buildScanChannelPrompt(channel),
    buildScanUserPrompt(sheetType, channel.maxPairs, channel.plan),
    extraUserText ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const content: Array<Record<string, unknown>> = [{ type: 'text', text: userPrompt }];
  if (imageBase64) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${imageBase64}`,
        detail: imageDetail,
      },
    });
  }

  const reasoning = isReasoningVisionModel(channel.model);
  const body: Record<string, unknown> = {
    model: channel.model,
    response_format: {
      type: 'json_schema',
      json_schema: SCANPLAY_EXTRACT_JSON_SCHEMA,
    },
    messages: [
      { role: 'system', content: selectScanSystemPrompt(sheetType) },
      { role: 'user', content },
    ],
  };

  if (reasoning) {
    body.max_completion_tokens = outputBudget(sheetType, channel.maxPairs, true, light);
    body.reasoning_effort = light ? 'low' : scanReasoningEffort(sheetType);
  } else {
    body.temperature = 0.1;
    body.max_tokens = outputBudget(sheetType, channel.maxPairs, false, light);
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

function visionToPayload(
  sheetType: string,
  pairs: VisionOcrPair[],
  maxPairs: number,
  extraWarnings: string[] = [],
): ExtractPayload {
  return {
    readable: pairs.length >= 2,
    sheetType: sheetType as ExtractPayload['sheetType'],
    detectedLangs: ['en', 'fr'],
    pairs: pairs.slice(0, maxPairs).map((p) => ({
      term: p.term,
      definition: p.definition,
      faces: [],
      termLang: looksEn(p.term) ? 'en' : looksFr(p.term) ? 'fr' : 'unknown',
      defLang: looksEn(p.definition) ? 'en' : looksFr(p.definition) ? 'fr' : 'unknown',
      confidence: p.confidence,
    })),
    warnings: [...extraWarnings, 'vision_ocr'],
  };
}

function mergeExtractPayloads(primary: ExtractPayload, extra: ExtractPayload, maxPairs: number): ExtractPayload {
  const outPairs: ExtractPair[] = [];
  const seen = new Set<string>();
  for (const p of [...(primary.pairs ?? []), ...(extra.pairs ?? [])]) {
    if (!p || typeof p.term !== 'string' || typeof p.definition !== 'string') continue;
    const termKey = p.term.toLowerCase().trim();
    if (!termKey || seen.has(termKey)) continue;
    seen.add(termKey);
    outPairs.push(p);
    if (outPairs.length >= maxPairs) break;
  }
  const warnings = [
    ...(Array.isArray(primary.warnings) ? primary.warnings.filter((w) => typeof w === 'string') : []),
    ...(Array.isArray(extra.warnings) ? extra.warnings.filter((w) => typeof w === 'string') : []),
  ];
  return {
    readable: Boolean(primary.readable || extra.readable),
    sheetType: primary.sheetType ?? extra.sheetType,
    detectedLangs:
      Array.isArray(primary.detectedLangs) && primary.detectedLangs.length
        ? primary.detectedLangs
        : extra.detectedLangs,
    pairs: outPairs,
    warnings,
  };
}

function pickRicherPayload(a: ExtractPayload, b: ExtractPayload, maxPairs: number): ExtractPayload {
  const merged = mergeExtractPayloads(a, b, maxPairs);
  const aLen = a.pairs?.length ?? 0;
  const bLen = b.pairs?.length ?? 0;
  if (merged.pairs && merged.pairs.length >= Math.max(aLen, bLen)) return merged;
  return bLen > aLen ? { ...b, pairs: (b.pairs ?? []).slice(0, maxPairs) } : a;
}

function looksFr(text: string): boolean {
  return (
    /[àâäéèêëïîôùûüç]/i.test(text) ||
    /\b\w+['’]\w+/u.test(text) ||
    /\b(je|tu|nous|vous|qui|c'est|ça|le|la|les|des|du)\b/i.test(text)
  );
}

function looksEn(text: string): boolean {
  return /\b(i|i'm|i am|it's|my|who|leave|well|don't|am|are|is|the|and|with|every)\b/i.test(text);
}

/** Drop clear same-language junk when bilingual rows already exist. */
function dropSameLangServer(pairs: ExtractPair[]): ExtractPair[] {
  const scored = pairs.map((p) => {
    const term = String(p.term ?? '');
    const def = String(p.definition ?? '');
    const enT = looksEn(term);
    const frT = looksFr(term);
    const enD = looksEn(def);
    const frD = looksFr(def);
    const cross = (enT && frD) || (frT && enD);
    const same = (frT && frD && !enT && !enD) || (enT && enD && !frT && !frD);
    return { p, cross, same };
  });
  const crossCount = scored.filter((s) => s.cross).length;
  /* ≥2 clear translations ⇒ sheet is bilingual — drop FR→FR / EN→EN. */
  if (crossCount < 2) return pairs;
  return scored.filter((s) => s.cross || !s.same).map((s) => s.p);
}

function buildVisionHint(pairs: VisionOcrPair[], fullText: string, maxPairs: number): string {
  const listed = pairs
    .slice(0, 40)
    .map((p) => `${p.term} → ${p.definition}`)
    .join('\n');
  return `OCR Google Vision (géométrie 2 colonnes) — base fiable :
${listed || '(peu de paires colonnes)'}

Texte brut (extrait) :
${fullText.slice(0, 2500)}

Utilise cette OCR pour couvrir TOUTES les lignes jusqu'à ${maxPairs}.
Corrige coupures (interdit FR→FR / "De qui s'agit"→"il ?").
Garde langue1→langue2. Ajoute seulement les lignes manquantes ou mal coupées.`;
}

async function parseOpenAiPayload(
  openaiCall: { ok: boolean; text: string },
): Promise<{ payload: ExtractPayload | null; finishReason?: string }> {
  if (!openaiCall.ok) return { payload: null };
  let openaiJson: {
    choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
  };
  try {
    openaiJson = JSON.parse(openaiCall.text) as typeof openaiJson;
  } catch {
    return { payload: null };
  }
  const content = openaiJson?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') return { payload: null };
  try {
    const parsed = asExtractPayload(JSON.parse(content));
    return { payload: parsed, finishReason: openaiJson?.choices?.[0]?.finish_reason };
  } catch {
    return { payload: null };
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
    const platform = normalizeScanPlatform(body.platform);
    const channel = resolveScanChannel(plan, platform);

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

    const vision = await runGoogleVisionOcr(imageBase64);
    const visionPairs = vision?.pairs ?? [];
    const visionWarnings = vision?.warnings ?? [];
    const visionStrong = visionOcrIsStrong(sheetType, visionPairs.length);
    let payload: ExtractPayload | null = null;

    if (visionStrong) {
      payload = visionToPayload(sheetType, visionPairs, channel.maxPairs, visionWarnings);
      /* ≥10 solid column pairs → trust Vision; don't let a light GPT call invent FR→FR. */
      payload.warnings = [...(payload.warnings ?? []), 'vision_only'];
    } else {
      const visionHint =
        visionPairs.length >= 4
          ? buildVisionHint(visionPairs, vision?.fullText ?? '', channel.maxPairs)
          : undefined;
      const firstDetail = scanImageDetail(channel.model);
      let openaiCall = await requestOpenAi(
        openaiKey,
        buildOpenAiBody(channel, sheetType, imageBase64, mimeType, firstDetail, visionHint),
      );

      if (!openaiCall.ok && firstDetail === 'original' && shouldRetryWithoutOriginal(openaiCall.text)) {
        openaiCall = await requestOpenAi(
          openaiKey,
          buildOpenAiBody(channel, sheetType, imageBase64, mimeType, 'high', visionHint),
        );
      }

      if (!openaiCall.ok) {
        if (visionPairs.length >= 4) {
          payload = visionToPayload(sheetType, visionPairs, channel.maxPairs, [
            ...(vision?.warnings ?? []),
            'openai_failed_vision_fallback',
          ]);
        } else {
          console.error('analyze-sheet upstream failed', openaiCall.status, channel.label);
          return new Response(JSON.stringify({ error: 'analysis_failed' }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        const parsed = await parseOpenAiPayload(openaiCall);
        payload = parsed.payload;
        if (!payload) {
          if (visionPairs.length >= 4) {
            payload = visionToPayload(sheetType, visionPairs, channel.maxPairs, vision?.warnings ?? []);
          } else {
            return new Response(JSON.stringify({ error: 'analysis_failed' }), {
              status: 502,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } else {
          if (parsed.finishReason === 'length') {
            payload.warnings = [...(payload.warnings ?? []), 'extraction_truncated'];
          }
          if (visionPairs.length > 0) {
            payload = mergeExtractPayloads(
              visionToPayload(sheetType, visionPairs, channel.maxPairs, vision?.warnings ?? []),
              payload,
              channel.maxPairs,
            );
          }

          let pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
          if (
            !visionStrong &&
            needsFullRecount(sheetType, pairs.length, channel.maxPairs, parsed.finishReason)
          ) {
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
            const contParsed = await parseOpenAiPayload(contCall);
            if (contParsed.payload) {
              payload = pickRicherPayload(payload, contParsed.payload, channel.maxPairs);
            }
          }
        }
      }
    }

    if (!payload) {
      return new Response(JSON.stringify({ error: 'analysis_failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (sheetType === 'vocab' && Array.isArray(payload.pairs)) {
      payload.pairs = dropSameLangServer(payload.pairs);
    }

    if (Array.isArray(payload.pairs) && payload.pairs.length > channel.maxPairs) {
      payload.pairs = payload.pairs.slice(0, channel.maxPairs);
    }

    const mode = visionStrong ? 'vision-first' : 'gpt-first';
    payload.warnings = [
      ...(payload.warnings ?? []),
      ...visionWarnings,
      mode,
      `vision_pairs_${visionPairs.length}`,
    ].filter((w, i, arr) => typeof w === 'string' && arr.indexOf(w) === i);

    console.info('[analyze-sheet-done]', {
      channel: channel.label,
      vision: visionPairs.length,
      final: payload.pairs?.length ?? 0,
      mode,
      visionWarnings,
    });

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
