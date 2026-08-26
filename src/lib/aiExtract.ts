import { fixOcrLine, isMathLikeText } from './vocabulary';
import { looksLikeLatex } from './mathText';
import { dropSiblingOcrFragments, isGarbageVocabTerm, isSectionTitle, isExampleSentence } from './pairQuality';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { getMaxWords } from './planLimits';
import type { LangCode, SheetType, WordPair } from '../types';

export interface AiExtractPair {
  term: string;
  definition: string;
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

const LANGS = new Set<LangCode>(['nl', 'fr', 'en', 'unknown']);

function normalizeLang(value: unknown): LangCode | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.toLowerCase();
  if (v === 'es') return 'en';
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

export function mapAiPairsToWordPairs(pairs: AiExtractPair[], options?: { mathSheet?: boolean }): WordPair[] {
  const mapped = pairs
    .filter((p) => p.term?.trim() && p.definition?.trim())
    .map((p) => {
      const scientific = options?.mathSheet || isScientificPair(p);
      const rawTerm = scientific ? p.term.trim() : stripVocabDecorations(p.term.trim());
      const rawDef = scientific ? p.definition.trim() : stripVocabDecorations(p.definition.trim());
      const term = scientific ? rawTerm.slice(0, 120) : fixOcrLine(rawTerm).slice(0, 55);
      const definition = scientific
        ? rawDef.slice(0, 280)
        : fixOcrLine(rawDef).slice(0, 120);
      return {
        term,
        definition,
        termLang: normalizeLang(p.termLang),
        defLang: normalizeLang(p.defLang),
        quality: (p.confidence === 'low' ? 'uncertain' : 'trusted') as WordPair['quality'],
      };
    })
    .filter((p) => {
      if (options?.mathSheet || isMathLikeText(p.term) || isMathLikeText(p.definition) || looksLikeLatex(p.term) || looksLikeLatex(p.definition)) {
        return p.term.toLowerCase() !== p.definition.toLowerCase();
      }
      return (
        !isGarbageVocabTerm(p.term) &&
        !isGarbageVocabTerm(p.definition) &&
        !isSectionTitle(p.term) &&
        !isSectionTitle(p.definition) &&
        (!isExampleSentence(p.term) || p.term.split(/\s+/).length <= 2) &&
        (!isExampleSentence(p.definition) || p.definition.split(/\s+/).length <= 2) &&
        p.term.toLowerCase() !== p.definition.toLowerCase()
      );
    });
  if (options?.mathSheet) return mapped;
  return dropSiblingOcrFragments(mapped);
}

function pairKey(term: string, definition: string): string {
  return `${term.toLowerCase()}\t${definition.toLowerCase()}`;
}

/** Pairs dropped as fragments or garbage — kept off the review list. */
export function collectIgnoredAiPairs(pairs: AiExtractPair[], options?: { mathSheet?: boolean }): WordPair[] {
  const kept = new Set(mapAiPairsToWordPairs(pairs, options).map((p) => pairKey(p.term, p.definition)));
  return pairs
    .filter((p) => p.term?.trim() && p.definition?.trim())
    .map((p) => {
      const scientific = options?.mathSheet || isScientificPair(p);
      return {
        term: scientific ? p.term.trim().slice(0, 120) : fixOcrLine(p.term.trim()).slice(0, 55),
        definition: scientific
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
    pairs: data.pairs.filter(
      (p): p is AiExtractPair =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as AiExtractPair).term === 'string' &&
        typeof (p as AiExtractPair).definition === 'string',
    ),
    warnings: Array.isArray(data.warnings)
      ? data.warnings.filter((w): w is string => typeof w === 'string')
      : [],
  };
}

function loadImageForAi(file: File, maxWidth = 1200): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const mimeType = 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, maxWidth >= 1600 ? 0.9 : 0.85);
      const base64 = dataUrl.split(',')[1] ?? '';
      if (!base64) {
        reject(new Error('Encode failed'));
        return;
      }
      resolve({ base64, mimeType });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

export function isAiScanEnabled(): boolean {
  if (!isSupabaseConfigured) return false;
  const flag = import.meta.env.VITE_AI_SCAN;
  return flag !== '0' && flag !== 'false';
}

export async function analyzeSheetWithAi(
  file: File,
  sheetType: SheetType,
): Promise<AiExtractResponse | null> {
  if (!isAiScanEnabled()) return null;

  const supabase = getSupabase();
  if (!supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { base64, mimeType } = await loadImageForAi(
    file,
    sheetType === 'vocab' ? 1800 : 1600,
  );

  const maxPairs = getMaxWords();

  const { data, error } = await supabase.functions.invoke('analyze-sheet', {
    body: {
      imageBase64: base64,
      mimeType,
      sheetType,
      maxPairs,
    },
  });

  if (error || !data) return null;
  return parseAiExtractResponse(data, sheetType);
}
