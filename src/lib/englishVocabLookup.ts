import {
  ENGLISH_LESSONS,
  type EnglishNativeLang,
  type EnglishVocabItem,
} from './englishCurriculum';

let glossByEn: Map<string, EnglishVocabItem> | null = null;

function normalizeEnKey(en: string): string {
  return en.trim().toLowerCase().replace(/[’']/g, "'");
}

function ensureGlossIndex(): Map<string, EnglishVocabItem> {
  if (glossByEn) return glossByEn;
  glossByEn = new Map();
  for (const lesson of ENGLISH_LESSONS) {
    for (const item of lesson.items) {
      const key = normalizeEnKey(item.en);
      if (key && !glossByEn.has(key)) glossByEn.set(key, item);
    }
  }
  return glossByEn;
}

export function lookupEnglishVocabItem(en: string): EnglishVocabItem | null {
  return ensureGlossIndex().get(normalizeEnKey(en)) ?? null;
}

export function lookupEnglishNativeGloss(
  en: string,
  lang: EnglishNativeLang,
): string | null {
  const item = lookupEnglishVocabItem(en);
  if (!item) return null;
  const gloss = item[lang]?.trim();
  return gloss || null;
}

/** All EN lemmas known in the Universe curriculum, longest first (for phrase matching). */
export function englishVocabKeysLongestFirst(): string[] {
  return [...ensureGlossIndex().keys()].sort((a, b) => b.length - a.length);
}
