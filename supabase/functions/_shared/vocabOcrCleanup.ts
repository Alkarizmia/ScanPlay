/**
 * Post-OCR / post-Vision cleanup for vocab cells.
 * Fixes classic DOCUMENT_TEXT_DETECTION glitches on EN infinitives.
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

/** "Tobe" → "To be", "Tosee" → "To see", "Totry" → "To try" */
export function unglueEnglishInfinitive(text: string): string {
  let s = text.trim();
  s = s.replace(/\bTo([a-zà-ÿ]{2,})\b/g, 'To $1');
  s = s.replace(/\bTO([A-Z][a-z]{1,})\b/g, 'To $1');
  /* "To le ave" / "To leav e" common leave breaks */
  s = s.replace(/\bTo\s+le\s*ave\b/gi, 'To leave');
  s = s.replace(/\bTo\s+leav\s*e\b/gi, 'To leave');
  return s.replace(/\s+/g, ' ').trim();
}

/** Light FR OCR fixes seen on verb lists. */
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

export interface VocabPairLike {
  term?: string;
  definition?: string;
  faces?: string[];
  termLang?: string;
  defLang?: string;
  confidence?: string;
}

export function sanitizeVocabExtractPairs<T extends VocabPairLike>(pairs: T[]): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const p of pairs) {
    if (!p || typeof p.term !== 'string' || typeof p.definition !== 'string') continue;
    const term = normalizeVocabOcrCell(p.term, 'term');
    let definition = normalizeVocabOcrCell(p.definition, 'definition');
    if (/^to\s*do$/i.test(term) && /^taire$/i.test(definition)) definition = 'faire';
    if (!term || !definition) continue;
    if (isSheetChromeText(term) || isSheetChromeText(definition)) continue;
    if (isSheetChromeText(`${term} ${definition}`)) continue;
    if (term.toLowerCase() === definition.toLowerCase()) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...p, term, definition });
  }
  return out;
}
