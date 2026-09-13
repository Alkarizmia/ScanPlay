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
import { looksEn, looksFr } from '../_shared/scanLang.ts';
import {
  isFusedRowPair,
  sanitizeVocabExtractPairs,
  vocabTermDedupeKey,
} from '../_shared/vocabOcrCleanup.ts';

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

function pairLangScore(p: ExtractPair): number {
  const term = String(p.term ?? '');
  const def = String(p.definition ?? '');
  const enT = looksEn(term);
  const frT = looksFr(term);
  const enD = looksEn(def);
  const frD = looksFr(def);
  if ((enT && frD) || (frT && enD)) return 3;
  if ((frT && frD && !enT) || (enT && enD && !frD)) return 0;
  return 1;
}

function mergeExtractPayloads(primary: ExtractPayload, extra: ExtractPayload, maxPairs: number): ExtractPayload {
  const byTerm = new Map<string, ExtractPair>();
  for (const p of [...(primary.pairs ?? []), ...(extra.pairs ?? [])]) {
    if (!p || typeof p.term !== 'string' || typeof p.definition !== 'string') continue;
    const termKey = vocabTermDedupeKey(p.term) || p.term.toLowerCase().trim();
    if (!termKey) continue;
    const prev = byTerm.get(termKey);
    if (!prev || pairLangScore(p) > pairLangScore(prev)) {
      byTerm.set(termKey, p);
    }
  }
  const outPairs = [...byTerm.values()].slice(0, maxPairs);
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
  return `OCR Google Vision (géométrie / alignement) — AIDE SEULEMENT :
${listed || '(peu de paires colonnes)'}

Texte brut OCR (peut coller "Tobe" au lieu de "To be") :
${fullText.slice(0, 2500)}

Règles:
- La PHOTO est la source de vérité pour l'orthographe et les espaces.
- Corrige les fusions OCR (Tobe→To be, Tosee→To see, de mander→demander).
- Ignore titres ("25 verbes…", Anglais/Français).
- Couvre TOUTES les lignes jusqu'à ${maxPairs} (table complète).
- Garde langue1→langue2. INTERDIT FR→FR / coupes "De qui s'agit"→"il ?".`;
}

async function parseOpenAiPayload(
  openaiCall: { ok: boolean; text: string },
): Promise<{ payload: ExtractPayload | null; finishReason?: string }> {
  if (!openaiCall.ok) return { payload: null };
  let openaiJson: {
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: string | Array<{ type?: string; text?: string }> };
    }>;
  };
  try {
    openaiJson = JSON.parse(openaiCall.text) as typeof openaiJson;
  } catch {
    return { payload: null };
  }
  const rawContent = openaiJson?.choices?.[0]?.message?.content;
  let content = '';
  if (typeof rawContent === 'string') {
    content = rawContent;
  } else if (Array.isArray(rawContent)) {
    content = rawContent.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('');
  }
  if (!content.trim()) return { payload: null };

  const tryParse = (raw: string): ExtractPayload | null => {
    try {
      return asExtractPayload(JSON.parse(raw));
    } catch {
      return null;
    }
  };

  let parsed = tryParse(content.trim());
  if (!parsed) {
    const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) parsed = tryParse(fence[1].trim());
  }
  if (!parsed) {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start >= 0 && end > start) parsed = tryParse(content.slice(start, end + 1));
  }
  return { payload: parsed, finishReason: openaiJson?.choices?.[0]?.finish_reason };
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

    const visionWanted = sheetType !== 'math' && sheetType !== 'definitions';
    const vision = visionWanted ? await runGoogleVisionOcr(imageBase64) : null;
    const visionPairs = vision?.pairs ?? [];
    const visionWarnings = vision?.warnings ?? [];
    const visionStrong = visionOcrIsStrong(sheetType, visionPairs.length);
    let payload: ExtractPayload | null = null;
    let mode: 'gpt-primary' | 'vision-fallback' = 'gpt-primary';

    /* Math / définitions-formules: GPT only — Vision OCR is slow and destroys LaTeX tables. */
    if (sheetType === 'math' || sheetType === 'definitions') {
      const firstDetail = 'high' as const;
      let openaiCall = await requestOpenAi(
        openaiKey,
        buildOpenAiBody(channel, sheetType, imageBase64, mimeType, firstDetail),
      );
      if (openaiCall.ok) {
        const parsed = await parseOpenAiPayload(openaiCall);
        payload = parsed.payload;
        if (payload) {
          if (parsed.finishReason === 'length') {
            payload.warnings = [...(payload.warnings ?? []), 'extraction_truncated'];
          }
          payload.sheetType = sheetType;
          payload.warnings = [...(payload.warnings ?? []), 'gpt_primary', 'math_no_vision'];
        }
      }
      /* Second pass if first returned nothing usable. */
      if ((!payload || (payload.pairs?.length ?? 0) < 2) && openaiCall.ok) {
        const retryCall = await requestOpenAi(
          openaiKey,
          buildOpenAiBody(
            channel,
            sheetType,
            imageBase64,
            mimeType,
            'high',
            sheetType === 'math'
              ? 'RETRY: la photo contient un tableau de formules. Extrais CHAQUE ligne en term→definition LaTeX. Minimum 2 paires. Ne renvoie pas pairs vide.'
              : 'RETRY: extrais toutes les notions/formules visibles. Minimum 2 paires.',
          ),
        );
        const retryParsed = await parseOpenAiPayload(retryCall);
        if (retryParsed.payload && (retryParsed.payload.pairs?.length ?? 0) > (payload?.pairs?.length ?? 0)) {
          payload = retryParsed.payload;
          payload.sheetType = sheetType;
          payload.warnings = [...(payload.warnings ?? []), 'gpt_math_retry'];
        }
      }
      /* Last resort for math: OCR text → GPT (no image). Does not run for vocab/notes. */
      if (sheetType === 'math' && (payload?.pairs?.length ?? 0) < 2) {
        const visionFb = await runGoogleVisionOcr(imageBase64);
        const ocrText = (visionFb?.fullText ?? '').trim();
        if (ocrText.length >= 40) {
          const textCall = await requestOpenAi(
            openaiKey,
            buildOpenAiBody(
              channel,
              'math',
              null,
              mimeType,
              'high',
              `Texte OCR d'une fiche de formules (tableau fonction → dérivée / résultat) :
${ocrText.slice(0, 4500)}

Transforme CHAQUE ligne utile en paire JSON : term = gauche (fonction), definition = droite (dérivée en LaTeX).
Exemple: term="\\\\sin x" definition="\\\\cos x" ; term="k" definition="0".
Minimum 2 paires. sheetType="math". Ignore titres et nom du prof.`,
            ),
          );
          const textParsed = await parseOpenAiPayload(textCall);
          if (textParsed.payload && (textParsed.payload.pairs?.length ?? 0) >= 2) {
            payload = textParsed.payload;
            payload.sheetType = 'math';
            payload.warnings = [
              ...(payload.warnings ?? []),
              ...(visionFb?.warnings ?? []),
              'math_ocr_text_fallback',
            ];
          }
        }
      }
      if (!payload) {
        console.error('analyze-sheet math/definitions failed', openaiCall.status, channel.label);
        return new Response(JSON.stringify({ error: 'analysis_failed' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      /* Keep short math answers; drop only empty cells. */
      if (Array.isArray(payload.pairs)) {
        payload.pairs = payload.pairs
          .filter(
            (p) =>
              typeof p?.term === 'string' &&
              typeof p?.definition === 'string' &&
              p.term.trim().length > 0 &&
              p.definition.trim().length > 0 &&
              p.term.trim().toLowerCase() !== p.definition.trim().toLowerCase(),
          )
          .map((p) => ({
            ...p,
            term: p.term!.trim(),
            definition: p.definition!.trim(),
            faces: Array.isArray(p.faces) ? p.faces : [],
            termLang: p.termLang ?? 'unknown',
            defLang: p.defLang ?? 'unknown',
            confidence: p.confidence ?? 'medium',
          }));
        payload.readable = payload.pairs.length >= 2;
      }
    } else if (sheetType === 'vocab') {
      const visionHint =
        visionPairs.length >= 2 || (vision?.fullText?.length ?? 0) > 40
          ? buildVisionHint(visionPairs, vision?.fullText ?? '', channel.maxPairs)
          : `Extrais TOUTES les lignes de vocabulaire visibles jusqu'à ${channel.maxPairs}.
Ignore titres/headers. Corrige orthographe depuis la photo.`;
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

      if (openaiCall.ok) {
        const parsed = await parseOpenAiPayload(openaiCall);
        payload = parsed.payload;
        if (payload) {
          if (parsed.finishReason === 'length') {
            payload.warnings = [...(payload.warnings ?? []), 'extraction_truncated'];
          }
          /* GPT text first. Vision only fills true gaps — never mash-row pairs (bottom gutter fail). */
          if (visionPairs.length > 0) {
            const gptCount = payload.pairs?.length ?? 0;
            const cleanVision = sanitizeVocabExtractPairs(
              visionPairs
                .filter((vp) => !isFusedRowPair(vp.term, vp.definition))
                .map((vp) => ({
                  term: vp.term,
                  definition: vp.definition,
                  faces: [] as string[],
                  termLang: 'en',
                  defLang: 'fr',
                  confidence: vp.confidence,
                })),
            );
            /* If GPT already covered the sheet well, skip Vision add (avoids 24→32 junk). */
            if (gptCount < 16 && cleanVision.length > 0) {
              payload = mergeExtractPayloads(
                payload,
                {
                  readable: true,
                  sheetType: 'vocab',
                  detectedLangs: ['en', 'fr'],
                  pairs: cleanVision,
                  warnings: visionWarnings,
                },
                channel.maxPairs,
              );
            } else if (gptCount >= 16) {
              payload.warnings = [...(payload.warnings ?? []), 'vision_merge_skipped_gpt_coverage'];
            }
          }
          let pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
          if (needsFullRecount(sheetType, pairs.length, channel.maxPairs, parsed.finishReason)) {
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
              payload.warnings = [...(payload.warnings ?? []), 'gpt_recount'];
            }
          }
          payload.warnings = [...(payload.warnings ?? []), 'gpt_primary'];
        }
      }

      if (!payload && visionPairs.length >= 4) {
        payload = visionToPayload(sheetType, visionPairs, channel.maxPairs, [
          ...visionWarnings,
          'openai_failed_vision_fallback',
        ]);
        mode = 'vision-fallback';
      } else if (!payload) {
        console.error('analyze-sheet upstream failed', openaiCall.status, channel.label);
        return new Response(JSON.stringify({ error: 'analysis_failed' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (visionStrong) {
      payload = visionToPayload(sheetType, visionPairs, channel.maxPairs, visionWarnings);
      const coverageTarget = Math.min(channel.maxPairs, 18);
      if (visionPairs.length >= coverageTarget) {
        payload.warnings = [...(payload.warnings ?? []), 'vision_only'];
        mode = 'vision-fallback';
      } else {
        const lightCall = await requestOpenAi(
          openaiKey,
          buildOpenAiBody(
            channel,
            sheetType,
            imageBase64,
            mimeType,
            'low',
            buildVisionHint(visionPairs, vision?.fullText ?? '', channel.maxPairs),
            true,
          ),
        );
        const { payload: gptPayload } = await parseOpenAiPayload(lightCall);
        if (gptPayload) {
          payload = mergeExtractPayloads(payload, gptPayload, channel.maxPairs);
          payload.warnings = [...(payload.warnings ?? []), 'vision_plus_light_gpt'];
        } else {
          payload.warnings = [...(payload.warnings ?? []), 'vision_only'];
          mode = 'vision-fallback';
        }
      }
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
          mode = 'vision-fallback';
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
            mode = 'vision-fallback';
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
              payload,
              visionToPayload(sheetType, visionPairs, channel.maxPairs, vision?.warnings ?? []),
              channel.maxPairs,
            );
          }

          let pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
          if (needsFullRecount(sheetType, pairs.length, channel.maxPairs, parsed.finishReason)) {
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
      payload.pairs = sanitizeVocabExtractPairs(payload.pairs);
      payload.pairs = dropSameLangServer(payload.pairs);
    }

    if (Array.isArray(payload.pairs) && payload.pairs.length > channel.maxPairs) {
      payload.pairs = payload.pairs.slice(0, channel.maxPairs);
    }

    const finalCount = payload.pairs?.length ?? 0;
    payload.warnings = [
      ...(payload.warnings ?? []),
      ...visionWarnings,
      mode,
      `vision_pairs_${visionPairs.length}`,
      `vision_raw_${vision?.rawPairCount ?? visionPairs.length}`,
      `final_${finalCount}`,
    ].filter((w, i, arr) => typeof w === 'string' && arr.indexOf(w) === i);

    console.info('[analyze-sheet-done]', {
      channel: channel.label,
      visionRaw: vision?.rawPairCount ?? visionPairs.length,
      vision: visionPairs.length,
      final: finalCount,
      mode,
      visionWarnings,
    });

    /* Don't burn a daily scan when extraction produced nothing usable. */
    if (supabaseAdmin && finalCount >= 2) {
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
