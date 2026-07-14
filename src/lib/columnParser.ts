import type { LangCode, WordPair } from '../types';
import { fixOcrLine, isInstructionText } from './vocabulary';
import { lookupLoanwordGloss } from './loanwordGlosses';
import {
  enrichTeachablePairs,
  isExampleSentence,
  isGarbageVocabTerm,
  isPlayableDefinition,
  isSectionTitle,
  looksLikeStandaloneVocabWord,
} from './pairQuality';

const TITLE_PATTERNS = [
  /^(vocabulaire|vocabulary|lexique|woordenlijst|wordlist)\b/i,
  /\b(un peu de|liste de|list of)\b/i,
  /^(nom|name|mot|word|terme|term|français|francais|english|anglais|néerlandais|dutch)\s*[:.]?\s*$/i,
  /^(scanplay|date|classe|class|page\s+\d+)\b/i,
  /^(le|la|les|het|de)\s+r[eè]gne\b/i,
  /^les\s+conjonctions\b/i,
  /^personnages\s+en\s+relaties\b/i,
  /^verandering\s*&\s*verschil\b/i,
  /^gevoelens\s*&\s*reacties\b/i,
];

export function isTitleLine(line: string): boolean {
  const cleaned = fixOcrLine(line.trim());
  if (!cleaned || cleaned.length < 2) return true;
  if (TITLE_PATTERNS.some((p) => p.test(cleaned))) return true;
  if (isSectionTitle(cleaned)) return true;
  if (isInstructionText(cleaned)) return true;
  if (/^vocabulaire\b/i.test(cleaned) && cleaned.split(/\s+/).length <= 4) return true;
  return false;
}

export function scoreDutch(text: string): number {
  let score = 0;
  if (/\(\s*de\s*\)|\(\s*het\s*\)|\(\s*een\s*\)/i.test(text)) score += 4;
  if (/\b(een|van|te|om|niet|gezien|gek|geloven|ervaring|kust|intussen|kennen|elk|elke)\b/i.test(text)) {
    score += 2;
  }
  if (/\w+(lijk|isch|achtig)\b/i.test(text)) score += 1;
  if (/\b(de|het|een)\b/i.test(text) && !/\b(la|le|les|l')\b/i.test(text)) score += 1;
  return score;
}

export function scoreFrench(text: string): number {
  let score = 0;
  if (/l[''']|l'|\bd['']|\b(la|le|les|des|du|au|aux)\b/i.test(text)) score += 3;
  if (/\b(à|entier|croire|c'est|entretemps|connaitre|connaître|enfantin|honnêtement|chaque)\b/i.test(text)) {
    score += 2;
  }
  if (/[àâäéèêëïîôùûü]/i.test(text)) score += 1;
  return score;
}

export function detectLang(text: string): LangCode {
  const nl = scoreDutch(text);
  const fr = scoreFrench(text);
  if (nl > fr + 1) return 'nl';
  if (fr > nl + 1) return 'fr';
  if (/\b(the|and|with|your)\b/i.test(text)) return 'en';
  return 'unknown';
}

export function splitLineIntoColumns(line: string): [string, string] | null {
  const cleaned = fixOcrLine(line);
  if (!cleaned) return null;

  const tabParts = cleaned.split('\t').map((p) => p.trim()).filter(Boolean);
  if (tabParts.length >= 2) {
    return [tabParts[0], tabParts.slice(1).join(' ')];
  }

  const wideGap = cleaned.match(/^(.+?)\s{2,}(.+)$/);
  if (wideGap) {
    return [wideGap[1].trim(), wideGap[2].trim()];
  }

  const arrow = cleaned.match(/^(.+?)\s*(?:->|→|=>)\s*(.+)$/);
  if (arrow) {
    return [arrow[1].trim(), arrow[2].trim()];
  }

  const emDash = cleaned.match(/^(.+?)\s*[–—]\s*(.+)$/);
  if (emDash && !/\t/.test(cleaned) && emDash[1].trim().split(/\s+/).length <= 2) {
    return [emDash[1].trim(), emDash[2].trim()];
  }

  const pipeParts = cleaned.split(/\s*\|\s*/);
  if (pipeParts.length >= 2) {
    return [pipeParts[0].trim(), pipeParts.slice(1).join(' | ').trim()];
  }

  return null;
}

export function primarySegment(text: string): string {
  const beforeSlash = text.split(/\s*\/\s*/)[0]?.trim() ?? text.trim();
  const parts = beforeSlash.split(/\s*[–—-]\s*/);
  return parts[0]?.trim() ?? text.trim();
}

const WORD_LIST_TITLE_PATTERNS = [
  /mots?\s+fran[cç]ais.{0,30}(langue\s+)?anglaise/i,
  /french\s+words?\s+in\s+(the\s+)?english/i,
  /loanwords?/i,
  /emprunts?\s+(fran[cç]ais|linguistiques?)/i,
];

function hasDutchMorphology(text: string): boolean {
  return /\w+(lijk|heid|isch|achtig)\b/i.test(text);
}

function hasFrenchMorphology(text: string): boolean {
  return /[àâäéèêëïîôùûüçœæ]|(tion|ment|eau|eux)\b/i.test(text);
}

function isShortVocabToken(text: string): boolean {
  const cleaned = text.trim();
  if (!cleaned || cleaned.length > 32) return false;
  return cleaned.split(/\s+/).length <= 3;
}

/** Row looks like NL↔FR (or similar) translation, not two standalone list items. */
export function hasTranslationRowSignals(left: string, right: string): boolean {
  if (/\([^)]*\)/.test(left) || /\([^)]*\)/.test(right)) return true;
  if (/\s[–—-]\s/.test(left) || /\s[–—-]\s/.test(right)) return true;

  const leftNl = scoreDutch(left);
  const leftFr = scoreFrench(left);
  const rightNl = scoreDutch(right);
  const rightFr = scoreFrench(right);

  if ((leftNl >= 2 && rightFr >= 2) || (leftFr >= 2 && rightNl >= 2)) return true;
  if (leftNl >= 1 && rightFr >= 2) return true;
  if (leftFr >= 2 && rightNl >= 1) return true;
  if (hasDutchMorphology(left) && hasFrenchMorphology(right)) return true;
  if (hasFrenchMorphology(left) && hasDutchMorphology(right)) return true;

  const leftLang = detectLang(left);
  const rightLang = detectLang(right);
  if (leftLang !== 'unknown' && rightLang !== 'unknown' && leftLang !== rightLang) return true;

  return false;
}

/** Two short standalone words on one row — typical 2-column word list layout. */
export function isLikelyDualColumnWordListRow(left: string, right: string): boolean {
  if (!isShortVocabToken(left) || !isShortVocabToken(right)) return false;
  if (hasTranslationRowSignals(left, right)) return false;
  return true;
}

export function detectLayoutFromTitle(text: string): 'translation' | 'word_list' | null {
  const header = text.split(/\r?\n/).slice(0, 4).join(' ');
  if (WORD_LIST_TITLE_PATTERNS.some((p) => p.test(header))) return 'word_list';
  return null;
}

export function detectDualColumnLayout(rows: Array<[string, string]>): 'translation' | 'word_list' {
  if (rows.length === 0) return 'translation';

  let listScore = 0;
  let transScore = 0;
  for (const [left, right] of rows) {
    if (hasTranslationRowSignals(left, right)) transScore += 1;
    else if (isLikelyDualColumnWordListRow(left, right)) listScore += 1;
  }

  if (listScore >= 3 && listScore >= transScore) return 'word_list';
  if (listScore >= 2 && transScore === 0) return 'word_list';
  return 'translation';
}

/** @deprecated Use loanword glosses — kept for tests only. */
export function wordListHint(word: string): string {
  const core = word.replace(/[^a-zA-Zàâäéèêëïîôùûüœæ'-]/g, '');
  if (core.length >= 5) {
    const tail = core.slice(-Math.min(4, Math.floor(core.length / 2)));
    return `…${tail}`;
  }
  if (core.length >= 2) return `Mot · ${core.length} lettres`;
  return 'Mot à retenir';
}

export function buildWordListPair(word: string): WordPair | null {
  const w = primarySegment(word).trim();
  if (!w || w.length < 2 || isGarbageVocabTerm(w)) return null;
  const gloss = lookupLoanwordGloss(w);
  if (!gloss) return null;
  return {
    term: w,
    definition: gloss,
    termLang: detectLang(w),
    defLang: 'fr',
  };
}

/** Split cells like "Déjà vu Detour" into separate vocabulary items. */
export function extractWordsFromCell(cell: string): string[] {
  const cleaned = fixOcrLine(cell.trim());
  if (!cleaned) return [];

  const parts = cleaned.split(/\s+(?=[A-ZÀ-Ÿ])/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => isShortVocabToken(p))) {
    return parts;
  }

  return [primarySegment(cleaned)];
}

function dedupeWordListPairs(pairs: WordPair[]): WordPair[] {
  const seen = new Set<string>();
  return pairs.filter((p) => {
    const key = p.term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseWordListRows(rows: Array<[string, string]>): WordPair[] {
  const pairs: WordPair[] = [];
  for (const [left, right] of rows) {
    for (const word of [...extractWordsFromCell(left), ...extractWordsFromCell(right)]) {
      const pair = buildWordListPair(word);
      if (pair) pairs.push(pair);
    }
  }
  return dedupeWordListPairs(pairs);
}

function expressionSegment(text: string): string | null {
  const parts = text.split(/\s*[–—-]\s*/);
  if (parts.length < 2) return null;
  const expr = parts.slice(1).join(' – ').trim();
  return expr.length > 2 ? expr : null;
}

function assignColumnPair(left: string, right: string): { term: string; definition: string; termLang: LangCode; defLang: LangCode } {
  let termSide = left.trim();
  let defSide = right.trim();

  const leftNl = scoreDutch(termSide);
  const leftFr = scoreFrench(termSide);
  const rightNl = scoreDutch(defSide);
  const rightFr = scoreFrench(defSide);

  if (leftFr + rightNl > leftNl + rightFr + 2) {
    [termSide, defSide] = [defSide, termSide];
  }

  let termLang = detectLang(termSide);
  let defLang = detectLang(defSide);

  if (termLang === 'unknown' && defLang === 'fr') termLang = 'nl';
  if (defLang === 'unknown' && termLang === 'nl') defLang = 'fr';
  if (termLang === 'unknown' && defLang === 'nl') termLang = 'fr';
  if (defLang === 'unknown' && termLang === 'fr') defLang = 'nl';

  return { term: termSide, definition: defSide, termLang, defLang };
}

export function pairFromColumnCells(left: string, right: string): WordPair[] {
  if (!left.trim() || !right.trim()) return [];
  if (isTitleLine(left) || isTitleLine(right)) return [];
  if (isSectionTitle(left) || isSectionTitle(right)) return [];

  const assigned = assignColumnPair(left, right);
  const pairs: WordPair[] = [];

  const termPrimary = primarySegment(assigned.term);
  const defPrimary = primarySegment(assigned.definition);

  if (isGarbageVocabTerm(termPrimary) || isGarbageVocabTerm(defPrimary)) return [];
  if (isSectionTitle(termPrimary) || isSectionTitle(defPrimary)) return [];
  if (isExampleSentence(termPrimary) && termPrimary.split(/\s+/).length >= 4) return [];
  if (isExampleSentence(defPrimary) && defPrimary.split(/\s+/).length >= 4) return [];

  if (termPrimary.length >= 2 && defPrimary.length >= 2) {
    pairs.push({
      term: termPrimary,
      definition: defPrimary,
      termLang: assigned.termLang,
      defLang: assigned.defLang,
    });
  }

  const termExpr = expressionSegment(assigned.term);
  const defExpr = expressionSegment(assigned.definition);
  if (termExpr && defExpr && !(isExampleSentence(termExpr) && termExpr.split(/\s+/).length >= 5)) {
    pairs.push({
      term: termExpr,
      definition: defExpr,
      termLang: assigned.termLang,
      defLang: assigned.defLang,
    });
  }

  return pairs;
}

/** Parse merged column OCR (tab or wide-gap separated lines). */
export function parseColumnText(
  text: string,
  forcedLayout?: 'translation' | 'word_list',
): WordPair[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => fixOcrLine(l.trim()))
    .filter((l) => l.length > 0 && !isTitleLine(l));

  const rows: Array<[string, string]> = [];
  for (const line of lines) {
    const cols = splitLineIntoColumns(line);
    if (!cols) continue;
    rows.push(cols);
  }

  const layout = forcedLayout ?? detectLayoutFromTitle(text) ?? detectDualColumnLayout(rows);
  if (layout === 'word_list' && rows.length > 0) {
    return parseWordListRows(rows);
  }

  const pairs: WordPair[] = [];
  for (const [left, right] of rows) {
    pairs.push(...pairFromColumnCells(left, right));
  }
  return pairs;
}

/** Merge left/right column OCR line-by-line into tab-separated text. */
export function mergeDualColumnOcr(leftText: string, rightText: string): string {
  const leftLines = leftText
    .split(/\r?\n/)
    .map((l) => fixOcrLine(l.trim()))
    .filter(Boolean);
  const rightLines = rightText
    .split(/\r?\n/)
    .map((l) => fixOcrLine(l.trim()))
    .filter(Boolean);

  const max = Math.max(leftLines.length, rightLines.length);
  const merged: string[] = [];
  for (let i = 0; i < max; i += 1) {
    const l = leftLines[i] ?? '';
    const r = rightLines[i] ?? '';
    if (l && r) merged.push(`${l}\t${r}`);
    else if (l && !isTitleLine(l)) merged.push(l);
  }
  return merged.join('\n');
}

export function flattenMistranslatedPairsToWordList(pairs: WordPair[]): WordPair[] {
  const words: string[] = [];
  for (const p of pairs) {
    words.push(...extractWordsFromCell(p.term));
    if (looksLikeStandaloneVocabWord(p.definition)) {
      words.push(...extractWordsFromCell(p.definition));
    }
  }
  const rebuilt = words
    .map((w) => buildWordListPair(w))
    .filter((p): p is WordPair => p !== null);
  return dedupeWordListPairs(rebuilt);
}

/** AI/OCR paired unrelated short words from a 2-column word list. */
export function pairsLookLikeMistranslatedWordList(pairs: WordPair[]): boolean {
  if (pairs.length < 2) return false;

  const shortRows = pairs.filter(
    (p) => p.term.split(/\s+/).length <= 2 && p.definition.split(/\s+/).length <= 2,
  );
  if (shortRows.length < pairs.length * 0.75) return false;

  const crossLang = pairs.filter((p) => {
    const tl = p.termLang ?? detectLang(p.term);
    const dl = p.defLang ?? detectLang(p.definition);
    return tl !== 'unknown' && dl !== 'unknown' && tl !== dl;
  });
  if (crossLang.length >= pairs.length * 0.4) return false;

  const listLikeRows = pairs.filter(
    (p) =>
      isLikelyDualColumnWordListRow(p.term, p.definition) &&
      looksLikeStandaloneVocabWord(p.definition),
  );
  return listLikeRows.length >= Math.min(3, pairs.length * 0.6);
}

export function reconcileWordListPairs(pairs: WordPair[], sourceText?: string): WordPair[] {
  if (pairs.length < 2) return enrichTeachablePairs(pairs);

  const clean = pairs.filter((p) => !isGarbageVocabTerm(p.term));
  const teachableCount = clean.filter((p) => isPlayableDefinition(p.definition, p.term)).length;
  const crossLangPairs = clean.filter((p) => {
    const tl = detectLang(p.term);
    const dl = detectLang(p.definition);
    return tl !== 'unknown' && dl !== 'unknown' && tl !== dl;
  });
  if (crossLangPairs.length >= Math.min(3, clean.length * 0.5)) {
    return enrichTeachablePairs(clean);
  }
  if (teachableCount >= Math.min(3, clean.length * 0.5)) {
    return enrichTeachablePairs(clean);
  }

  const titleLayout = sourceText ? detectLayoutFromTitle(sourceText) : null;
  if (titleLayout === 'word_list' || pairsLookLikeMistranslatedWordList(clean)) {
    return enrichTeachablePairs(flattenMistranslatedPairsToWordList(clean));
  }

  return enrichTeachablePairs(clean);
}
export const NL_FR_FIXTURE = `
eerlijk\thonnêtement
elk, elke\tchaque
ervaring (de)\tl'expérience
fantastisch\tfantastique
gek – om gek van te worden\tfou – à devenir fou
gelijk (het) – gelijk hebben\tla raison – avoir raison
geloven – niet te geloven\tcroire – c'est incroyable
geweldig\tterrible
heel – de hele dag\tentier – toute la journée
intussen\tentretemps
`.trim();

export function runColumnParserSelfTest(): { ok: boolean; count: number; terms: string[] } {
  const pairs = parseColumnText(NL_FR_FIXTURE);
  const terms = pairs.map((p) => p.term.toLowerCase());
  const expected = ['eerlijk', 'elk', 'ervaring', 'fantastisch', 'gek', 'gelijk', 'geloven', 'geweldig', 'heel', 'intussen'];
  const found = expected.filter((e) => terms.some((t) => t.startsWith(e) || t.includes(e)));
  return { ok: found.length >= 10 && pairs.length >= 10, count: pairs.length, terms: pairs.map((p) => p.term) };
}
