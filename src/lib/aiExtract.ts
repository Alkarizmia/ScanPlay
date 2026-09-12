import { isAbortError, throwIfAborted } from './abort';
import { lookupVocabGloss } from './loanwordGlosses';
import { fixOcrLine, isMathLikeText } from './vocabulary';
import { looksLikeLatex } from './mathText';
import { dropSiblingOcrFragments, dropSameLanguageOutliers, isGarbageVocabTerm, isSectionTitle, isExampleSentence } from './pairQuality';
import { normalizeFaces } from './cardFaces';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { getMaxWords } from './planLimits';
import { blobToBase64, prepareSheetImage } from './sheetImage';
import { getScanPlatform } from './scanPlatform';
import type { LangCode, SheetType, WordPair } from '../types';

export interface AiExtractPair {
  term: string;
  definition: string;
  faces?: string[];
  termLang?: LangCode | 'unknown';
  defLang?: LangCode | 'unknown';
  confidence?: 'high' | 'medium' | 'low';
}

export interface AiExtractResponse {
  readable: boolean;
  sheetType: SheetType;
  detectedLangs?: string[];
  pairs: AiExtractPair[];
  warnings?: string[];
}

const LANGS = new Set<LangCode>(['nl', 'fr', 'en', 'es', 'unknown']);

function normalizeLang(value: unknown): LangCode | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.toLowerCase();
  if (v === 'es' || v === 'spa' || v === 'spanish') return 'es';
  return LANGS.has(v as LangCode) ? (v as LangCode) : 'unknown';
}

function isScientificPair(p: AiExtractPair): boolean {
  return looksLikeLatex(p.term) || looksLikeLatex(p.definition) || isMathLikeText(p.term) || isMathLikeText(p.definition);
}

function stripVocabDecorations(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/(^|\s)\*+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeVocabCell(text: string): string {
  let s = stripVocabDecorations(text).replace(/^[^\p{L}\p{N}(]+/u, '').trim();
  if (s.split(/\s+/).length <= 3) {
    s = s.replace(/[.\s]+$/g, '');
  }
  return repairOcrGlitches(s);
}

function vocabKey(text: string): string {
  return normalizeVocabCell(text).toLowerCase();
}

function looksLikeVocabAtom(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 55) return false;
  if (looksLikeLatex(t) || isMathLikeText(t)) return false;
  return t.split(/\s+/).length <= 6;
}

/** Split "riche (adj) / pauvre (adj)" × "rijk / arm" into two playable cards. */
export function expandAlignedVocabPairs(pairs: AiExtractPair[]): AiExtractPair[] {
  const out: AiExtractPair[] = [];
  for (const p of pairs) {
    if (looksLikeLatex(p.term) || looksLikeLatex(p.definition)) {
      out.push(p);
      continue;
    }
    const termParts = splitAlignedVocabCells(p.term);
    const defParts = splitAlignedVocabCells(p.definition);
    if (
      termParts.length >= 2 &&
      termParts.length === defParts.length &&
      termParts.length <= 4 &&
      termParts.every(looksLikeVocabAtom) &&
      defParts.every(looksLikeVocabAtom)
    ) {
      for (let i = 0; i < termParts.length; i += 1) {
        out.push({ ...p, term: termParts[i], definition: defParts[i] });
      }
      continue;
    }
    out.push(p);
  }
  return out;
}

function splitAlignedVocabCells(text: string): string[] {
  const stripped = stripVocabDecorations(text.trim());
  if (!/\s+[\/|]\s+/.test(stripped)) return [stripped];
  return stripped
    .split(/\s+[\/|]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function scoreNlToken(text: string): number {
  let s = 0;
  if (/\w+(lijk|heid|isch|achtig|eren|elen|atie)\b/i.test(text)) s += 2;
  if (/\b(de|het|een|van|te|om|niet)\b/i.test(text)) s += 1;
  if (/ij|oe|ui|aa|ee|oo/i.test(text)) s += 1;
  return s;
}

function scoreFrToken(text: string): number {
  let s = 0;
  if (/[àâäéèêëïîôùûüç]/i.test(text)) s += 2;
  if (/\b(le|la|les|un|une|des|du|et|à)\b/i.test(text)) s += 1;
  if (/\w+(tion|ment|eux|euse)\b/i.test(text)) s += 1;
  return s;
}

/** "emotioneel émotionnel" + "ontroerend émouvant" → two proper NL→FR cards. */
export function splitFusedBilingualPair(pair: AiExtractPair): AiExtractPair[] {
  const termParts = pair.term.trim().split(/\s+/).filter(Boolean);
  const defParts = pair.definition.trim().split(/\s+/).filter(Boolean);
  if (termParts.length !== 2 || defParts.length !== 2) return [pair];
  if ((pair.faces?.length ?? 0) > 0) return [pair];

  const [t0, t1] = termParts;
  const [d0, d1] = defParts;
  const termCross = scoreNlToken(t0) >= 1 && scoreFrToken(t1) >= 1;
  const defCross = scoreNlToken(d0) >= 1 && scoreFrToken(d1) >= 1;
  if (!termCross || !defCross) return [pair];

  return [
    { ...pair, term: t0, definition: t1, faces: [] },
    { ...pair, term: d0, definition: d1, faces: [] },
  ];
}

function repairOcrGlitches(text: string): string {
  return text
    .replace(/([a-zàâäéèêëïîôùûüç])!([a-zàâäéèêëïîôùûüç])/gi, '$1l$2')
    .replace(/([a-zàâäéèêëïîôùûüç])!$/gi, '$1l')
    .replace(/\bemotionee!/gi, 'emotioneel')
    .replace(/\|+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function mapAiPairsToWordPairs(pairs: AiExtractPair[], options?: { mathSheet?: boolean; freeText?: boolean }): WordPair[] {
  const freeText = options?.freeText === true;
  const expanded = options?.mathSheet || freeText ? pairs : expandAlignedVocabPairs(pairs);
  const source = options?.mathSheet || freeText
    ? expanded
    : expanded.flatMap((p) => splitFusedBilingualPair(p));
  const mapped = source
    .filter((p) => p.term?.trim() && p.definition?.trim())
    .map((p) => {
      const scientific = options?.mathSheet || isScientificPair(p);
      const keepRaw = scientific || freeText;
      const rawTerm = keepRaw ? p.term.trim() : normalizeVocabCell(p.term.trim());
      let rawDef = keepRaw ? p.definition.trim() : normalizeVocabCell(p.definition.trim());
      if (!scientific && !freeText && vocabKey(rawTerm) === vocabKey(rawDef)) {
        const gloss = lookupVocabGloss(rawTerm);
        if (gloss) rawDef = gloss;
      }
      const term = keepRaw ? rawTerm.slice(0, 120) : fixOcrLine(rawTerm).slice(0, 70);
      const definition = keepRaw
        ? rawDef.slice(0, 280)
        : fixOcrLine(rawDef).slice(0, 140);
      const faces = keepRaw
        ? normalizeFaces(p.faces)
        : normalizeFaces((p.faces ?? []).map((f) => normalizeVocabCell(f)));
      return {
        term,
        definition,
        faces,
        termLang: normalizeLang(p.termLang),
        defLang: normalizeLang(p.defLang),
        quality: (p.confidence === 'low' ? 'uncertain' : 'trusted') as WordPair['quality'],
      };
    })
    .filter((p) => {
      if (options?.mathSheet || isMathLikeText(p.term) || isMathLikeText(p.definition) || looksLikeLatex(p.term) || looksLikeLatex(p.definition)) {
        return p.term.toLowerCase() !== p.definition.toLowerCase();
      }
      const termWords = p.term.split(/\s+/).length;
      const defWords = p.definition.split(/\s+/).length;
      const hasFaces = (p.faces?.length ?? 0) > 0;
      /* Study phrases (I am coming / J'arrive) OK; long note definitions still dropped in vocab mode. */
      const looksLikeNoteCard =
        !options?.freeText &&
        termWords <= 2 &&
        defWords >= 5 &&
        isExampleSentence(p.definition);
      const allowPhrase = !looksLikeNoteCard && termWords <= 8 && defWords <= 8;
      return (
        !isGarbageVocabTerm(p.term) &&
        !isGarbageVocabTerm(p.definition) &&
        !isSectionTitle(p.term) &&
        !isSectionTitle(p.definition) &&
        (options?.freeText || hasFaces || allowPhrase || !isExampleSentence(p.term) || termWords <= 2) &&
        (options?.freeText || hasFaces || allowPhrase || !isExampleSentence(p.definition) || defWords <= 2) &&
        !looksLikeNoteCard &&
        p.term.toLowerCase() !== p.definition.toLowerCase() &&
        vocabKey(p.term) !== vocabKey(p.definition)
      );
    });
  if (options?.mathSheet || options?.freeText) return mapped;
  return dropSameLanguageOutliers(dropSiblingOcrFragments(mapped));
}

function pairKey(term: string, definition: string): string {
  return `${term.toLowerCase()}\t${definition.toLowerCase()}`;
}

/** Pairs dropped as fragments or garbage — kept off the review list. */
export function collectIgnoredAiPairs(pairs: AiExtractPair[], options?: { mathSheet?: boolean; freeText?: boolean }): WordPair[] {
  const kept = new Set(mapAiPairsToWordPairs(pairs, options).map((p) => pairKey(p.term, p.definition)));
  return pairs
    .filter((p) => p.term?.trim() && p.definition?.trim())
    .map((p) => {
      const scientific = options?.mathSheet || isScientificPair(p);
      const keepRaw = scientific || options?.freeText === true;
      return {
        term: keepRaw ? p.term.trim().slice(0, 120) : fixOcrLine(p.term.trim()).slice(0, 55),
        definition: keepRaw
          ? p.definition.trim().slice(0, 280)
          : fixOcrLine(p.definition.trim()).slice(0, 120),
        termLang: normalizeLang(p.termLang),
        defLang: normalizeLang(p.defLang),
        quality: 'uncertain' as const,
      };
    })
    .filter((p) => p.term && p.definition && !kept.has(pairKey(p.term, p.definition)));
}

const SHEET_TYPES: SheetType[] = ['vocab', 'notes', 'definitions', 'math'];

export function parseAiExtractResponse(raw: unknown, fallbackSheetType?: SheetType): AiExtractResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.pairs)) return null;

  let sheetType = data.sheetType;
  if (typeof sheetType !== 'string' || !SHEET_TYPES.includes(sheetType as SheetType)) {
    if (fallbackSheetType && SHEET_TYPES.includes(fallbackSheetType)) {
      sheetType = fallbackSheetType;
    } else {
      return null;
    }
  }

  return {
    readable: Boolean(data.readable),
    sheetType: sheetType as SheetType,
    detectedLangs: Array.isArray(data.detectedLangs)
      ? data.detectedLangs.filter((l): l is string => typeof l === 'string')
      : [],
    pairs: data.pairs
      .filter(
        (p): p is AiExtractPair =>
          typeof p === 'object' &&
          p !== null &&
          typeof (p as AiExtractPair).term === 'string' &&
          typeof (p as AiExtractPair).definition === 'string',
      )
      .map((p) => ({
        ...p,
        faces: normalizeFaces((p as AiExtractPair).faces) ?? [],
      })),
    warnings: Array.isArray(data.warnings)
      ? data.warnings.filter((w): w is string => typeof w === 'string')
      : [],
  };
}

const AI_SCAN_MAX_SIDE = 2000;
const AI_SCAN_JPEG_QUALITY = 0.86;

async function loadImageForAi(file: File): Promise<{ base64: string; mimeType: string }> {
  const prepared = await prepareSheetImage(file, {
    maxSide: AI_SCAN_MAX_SIDE,
    quality: AI_SCAN_JPEG_QUALITY,
    contrast: true,
  });
  const base64 = await blobToBase64(prepared.blob);
  if (!base64) throw new Error('Encode failed');
  return { base64, mimeType: 'image/jpeg' };
}

export function isAiScanEnabled(): boolean {
  if (!isSupabaseConfigured) return false;
  const flag = import.meta.env.VITE_AI_SCAN;
  return flag !== '0' && flag !== 'false';
}

export async function analyzeSheetWithAi(
  file: File,
  sheetType: SheetType,
  signal?: AbortSignal,
): Promise<AiExtractResponse | null> {
  if (!isAiScanEnabled()) return null;
  throwIfAborted(signal);

  const supabase = getSupabase();
  if (!supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  let base64: string | undefined;
  let mimeType: string;
  try {
    const encoded = await loadImageForAi(file);
    throwIfAborted(signal);
    base64 = encoded.base64;
    mimeType = encoded.mimeType;
  } catch (error) {
    if (isAbortError(error)) throw error;
    return null;
  }

  const maxPairs = getMaxWords();
  const url = import.meta.env.VITE_SUPABASE_URL ?? '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
  if (!url || !anonKey || !base64) return null;

  const payload = {
    imageBase64: base64,
    mimeType,
    sheetType,
    /* Hint only — server ignores this and uses Supabase profile plan. */
    maxPairs,
    platform: getScanPlatform(),
  };

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/functions/v1/analyze-sheet`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });
    throwIfAborted(signal);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    throwIfAborted(signal);
    return parseAiExtractResponse(data, sheetType);
  } catch (error) {
    if (isAbortError(error)) throw error;
    return null;
  }
}
