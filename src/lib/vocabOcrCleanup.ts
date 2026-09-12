/**
 * Post-OCR cleanup for vocab cells (keep in sync with supabase/.../vocabOcrCleanup.ts).
 */

const SHEET_TITLE_RE =
  /^\d*\s*verbes?\b|\bbasiques?\s+en\s+(anglais|français|english)\b|^anglais\s*$|^français\s*$|^english\s*$|^french\s*$|follow\s+me\s+for\s+more/i;

export function isSheetChromeText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (SHEET_TITLE_RE.test(t)) return true;
  if (/^anglais\s*[|/·\-–—]\s*français$/i.test(t)) return true;
  return false;
}

export function unglueEnglishInfinitive(text: string): string {
  let s = text.trim();
  s = s.replace(/\bTo([a-zà-ÿ]{2,})\b/g, 'To $1');
  s = s.replace(/\bTO([A-Z][a-z]{1,})\b/g, 'To $1');
  s = s.replace(/\bTo\s+le\s*ave\b/gi, 'To leave');
  s = s.replace(/\bTo\s+leav\s*e\b/gi, 'To leave');
  return s.replace(/\s+/g, ' ').trim();
}

export function fixCommonFrOcr(text: string): string {
  let s = text.trim();
  s = s.replace(/\bde\s+mander\b/gi, 'demander');
  s = s.replace(/\bfabriq\s*uer\b/gi, 'fabriquer');
  return s.replace(/\s+/g, ' ').trim();
}

export function normalizeVocabOcrCell(text: string, side: 'term' | 'definition' = 'term'): string {
  let s = text.trim();
  if (!s) return s;
  s = unglueEnglishInfinitive(s);
  if (side === 'definition') s = fixCommonFrOcr(s);
  return s.replace(/\s+/g, ' ').trim();
}
