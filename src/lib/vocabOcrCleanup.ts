/**
 * Post-OCR cleanup for vocab cells (keep in sync with supabase/.../vocabOcrCleanup.ts).
 */

const SHEET_TITLE_RE =
  /^\d*\s*verbes?\b|\bbasiques?\s+en\s+(anglais|français|english)\b|^anglais\s*$|^français\s*$|^english\s*$|^french\s*$|follow\s+me\s+for\s+more/i;

const FR_LEX =
  /\b(être|avoir|faire|dire|obtenir|fabriquer|aller|savoir|prendre|voir|venir|penser|regarder|vouloir|donner|trouver|raconter|demander|travailler|sembler|sentir|essayer|quitter|appeler|mal|tête|avance|retard)\b|[àâäéèêëïîôùûüç]/i;

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

export function splitFusedEnFrRow(text: string): { term: string; definition: string } | null {
  const cleaned = normalizeVocabOcrCell(text, 'term');
  const m = cleaned.match(/^(To\s+[A-Za-z']+)\s+(.+)$/i);
  if (!m) return null;
  const term = m[1]!.trim();
  const definition = fixCommonFrOcr(m[2]!.trim());
  if (!definition || /^to\s+/i.test(definition)) return null;
  if (!FR_LEX.test(definition) && !/^[a-zà-ÿ]/.test(definition)) return null;
  if (!FR_LEX.test(definition) && definition.split(/\s+/).length > 2) return null;
  return { term, definition };
}

export function vocabTermDedupeKey(term: string): string {
  const cleaned = normalizeVocabOcrCell(term, 'term');
  const split = splitFusedEnFrRow(cleaned);
  const head = (split?.term ?? cleaned).toLowerCase().replace(/\s+/g, ' ').trim();
  return head;
}

export function isFusedRowPair(term: string, definition: string): boolean {
  const t = normalizeVocabOcrCell(term, 'term');
  const d = normalizeVocabOcrCell(definition, 'definition');
  if (splitFusedEnFrRow(t) && splitFusedEnFrRow(d)) return true;
  if (splitFusedEnFrRow(t) && /^to\s+/i.test(d)) return true;
  return false;
}

export interface VocabPairLike {
  term?: string;
  definition?: string;
  faces?: string[];
  termLang?: string;
  defLang?: string;
  confidence?: string;
}

export function expandMisalignedRowPairs<T extends VocabPairLike>(pairs: T[]): T[] {
  const out: T[] = [];
  for (const p of pairs) {
    if (!p || typeof p.term !== 'string' || typeof p.definition !== 'string') continue;
    const term = normalizeVocabOcrCell(p.term, 'term');
    const definition = normalizeVocabOcrCell(p.definition, 'definition');
    const left = splitFusedEnFrRow(term);
    const right = splitFusedEnFrRow(definition);

    if (left && right) {
      out.push({
        ...p,
        term: left.term,
        definition: left.definition,
        termLang: 'en',
        defLang: 'fr',
      });
      out.push({
        ...p,
        term: right.term,
        definition: right.definition,
        termLang: 'en',
        defLang: 'fr',
      });
      continue;
    }

    if (left && !/^to\s+/i.test(definition)) {
      out.push({ ...p, term: left.term, definition: left.definition, termLang: 'en', defLang: 'fr' });
      continue;
    }

    out.push({ ...p, term, definition });
  }
  return out;
}

export function sanitizeVocabExtractPairs<T extends VocabPairLike>(pairs: T[]): T[] {
  const expanded = expandMisalignedRowPairs(pairs);
  const out: T[] = [];
  const seen = new Set<string>();
  for (const p of expanded) {
    if (!p || typeof p.term !== 'string' || typeof p.definition !== 'string') continue;
    const term = normalizeVocabOcrCell(p.term, 'term');
    let definition = normalizeVocabOcrCell(p.definition, 'definition');
    if (/^to\s*do$/i.test(term) && /^taire$/i.test(definition)) definition = 'faire';

    const fused = splitFusedEnFrRow(term);
    const finalTerm = fused && !/^to\s+/i.test(definition) ? fused.term : term;
    const finalDef = fused && !/^to\s+/i.test(definition) ? fused.definition : definition;

    if (!finalTerm || !finalDef) continue;
    if (isSheetChromeText(finalTerm) || isSheetChromeText(finalDef)) continue;
    if (isSheetChromeText(`${finalTerm} ${finalDef}`)) continue;
    if (finalTerm.toLowerCase() === finalDef.toLowerCase()) continue;
    if (/^to\s+[a-z']/i.test(finalDef) && FR_LEX.test(finalDef)) continue;

    const key = vocabTermDedupeKey(finalTerm);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...p,
      term: finalTerm,
      definition: finalDef,
      termLang: p.termLang ?? 'en',
      defLang: p.defLang ?? 'fr',
    });
  }
  return out;
}
