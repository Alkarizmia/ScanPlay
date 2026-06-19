import type { LangCode, WordPair } from '../types';
import { fixOcrLine, isInstructionText } from './vocabulary';

const TITLE_PATTERNS = [
  /^(vocabulaire|vocabulary|lexique|woordenlijst|wordlist)\b/i,
  /\b(un peu de|liste de|list of)\b/i,
  /^(nom|name|mot|word|terme|term|français|francais|english|anglais|néerlandais|dutch)\s*[:.]?\s*$/i,
  /^(scanplay|date|classe|class|page\s+\d+)\b/i,
];

export function isTitleLine(line: string): boolean {
  const cleaned = fixOcrLine(line.trim());
  if (!cleaned || cleaned.length < 2) return true;
  if (TITLE_PATTERNS.some((p) => p.test(cleaned))) return true;
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

  const pipeParts = cleaned.split(/\s*\|\s*/);
  if (pipeParts.length >= 2) {
    return [pipeParts[0].trim(), pipeParts.slice(1).join(' | ').trim()];
  }

  return null;
}

function primarySegment(text: string): string {
  const parts = text.split(/\s*[–—-]\s*/);
  return parts[0]?.trim() ?? text.trim();
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

  const assigned = assignColumnPair(left, right);
  const pairs: WordPair[] = [];

  const termPrimary = primarySegment(assigned.term);
  const defPrimary = primarySegment(assigned.definition);

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
  if (termExpr && defExpr) {
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
export function parseColumnText(text: string): WordPair[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => fixOcrLine(l.trim()))
    .filter((l) => l.length > 0 && !isTitleLine(l));

  const pairs: WordPair[] = [];
  for (const line of lines) {
    const cols = splitLineIntoColumns(line);
    if (!cols) continue;
    pairs.push(...pairFromColumnCells(cols[0], cols[1]));
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

/** Fixture simulating NL↔FR vocabulary sheet OCR output. */
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
