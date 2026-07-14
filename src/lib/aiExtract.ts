import { fixOcrLine } from './vocabulary';
import { isGarbageVocabTerm, isSectionTitle, isExampleSentence } from './pairQuality';
import { getSupabase, isSupabaseConfigured } from './supabase';
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

export function mapAiPairsToWordPairs(pairs: AiExtractPair[]): WordPair[] {
  return pairs
    .filter((p) => p.term?.trim() && p.definition?.trim())
    .map((p) => ({
      term: fixOcrLine(p.term.trim()).slice(0, 55),
      definition: fixOcrLine(p.definition.trim()).slice(0, 120),
      termLang: normalizeLang(p.termLang),
      defLang: normalizeLang(p.defLang),
    }))
    .filter((p) => !isGarbageVocabTerm(p.term) && !isGarbageVocabTerm(p.definition))
    .filter((p) => !isSectionTitle(p.term) && !isSectionTitle(p.definition))
    .filter((p) => !isExampleSentence(p.term) || p.term.split(/\s+/).length <= 2)
    .filter((p) => !isExampleSentence(p.definition) || p.definition.split(/\s+/).length <= 2)
    .filter((p) => p.term.toLowerCase() !== p.definition.toLowerCase());
}

export function parseAiExtractResponse(raw: unknown): AiExtractResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.pairs)) return null;

  const sheetType = data.sheetType;
  if (sheetType !== 'vocab' && sheetType !== 'notes' && sheetType !== 'definitions') {
    return null;
  }

  return {
    readable: Boolean(data.readable),
    sheetType,
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
      const dataUrl = canvas.toDataURL(mimeType, 0.85);
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

  const { base64, mimeType } = await loadImageForAi(file);

  const { data, error } = await supabase.functions.invoke('analyze-sheet', {
    body: {
      imageBase64: base64,
      mimeType,
      sheetType,
    },
  });

  if (error || !data) return null;
  return parseAiExtractResponse(data);
}
