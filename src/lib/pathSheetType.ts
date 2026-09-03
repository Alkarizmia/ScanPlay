import type { LangCode, SheetType, WordPair } from '../types';
import { detectLang } from './columnParser';
import { lookupVocabGloss } from './loanwordGlosses';
import { looksLikeLatex } from './mathText';
import { isMathLikeText } from './vocabulary';

let currentSheetType: SheetType = 'vocab';

export function setPathSheetType(sheetType: SheetType): void {
  currentSheetType = sheetType;
}

export function getPathSheetType(): SheetType {
  return currentSheetType;
}

/** Oral games: vocab, notes, definitions. Never math/science formulas. */
export function isOralAllowedForSheet(sheetType: SheetType = getPathSheetType()): boolean {
  return sheetType === 'vocab' || sheetType === 'notes' || sheetType === 'definitions';
}

const MATH_COURSE_WORD =
  /\b(domaine|racines?|asymptotes?|d[eé]riv|convexe|concave|signe|ordonn[eé]e|tableau|fonction|intervalle|infinie?|num[eé]rateur|d[eé]nominateur)\b/i;

export function pairLooksLikeMathCourse(pair: WordPair): boolean {
  return (
    isMathLikeText(pair.term) ||
    isMathLikeText(pair.definition) ||
    looksLikeLatex(pair.term) ||
    looksLikeLatex(pair.definition) ||
    MATH_COURSE_WORD.test(pair.term) ||
    MATH_COURSE_WORD.test(pair.definition)
  );
}

export function inferColumnLangs(pairs: WordPair[]): { term: LangCode; def: LangCode } {
  const hintedTerm = pairs.find((p) => p.termLang && p.termLang !== 'unknown')?.termLang;
  const hintedDef = pairs.find((p) => p.defLang && p.defLang !== 'unknown')?.defLang;
  return {
    term: hintedTerm ?? detectLang(pairs.map((p) => p.term).join(' ')),
    def: hintedDef ?? detectLang(pairs.map((p) => p.definition).join(' ')),
  };
}

function glossNorm(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function pairLooksTranslatable(pair: WordPair): boolean {
  const tl = pair.termLang && pair.termLang !== 'unknown' ? pair.termLang : detectLang(pair.term);
  const dl = pair.defLang && pair.defLang !== 'unknown' ? pair.defLang : detectLang(pair.definition);
  if (tl !== 'unknown' && dl !== 'unknown' && tl !== dl) return true;
  const gloss = lookupVocabGloss(pair.term);
  if (gloss && glossNorm(gloss) === glossNorm(pair.definition)) return true;
  const back = lookupVocabGloss(pair.definition);
  return Boolean(back && glossNorm(back) === glossNorm(pair.term));
}

/** Phrase tiles: bilingual vocab — including pictured word lists (apple → pomme). */
export function canUseTranslateGame(
  pairs: WordPair[],
  sheetType: SheetType = getPathSheetType(),
): boolean {
  if (sheetType !== 'vocab') return false;
  if (pairs.length === 0) return false;
  const mathHits = pairs.filter(pairLooksLikeMathCourse).length;
  if (mathHits >= Math.max(1, Math.ceil(pairs.length * 0.35))) return false;
  const langs = inferColumnLangs(pairs);
  if (langs.term !== 'unknown' && langs.def !== 'unknown' && langs.term !== langs.def) return true;
  const hits = pairs.filter(pairLooksTranslatable).length;
  return hits >= 1 && hits >= Math.min(2, Math.ceil(pairs.length * 0.35));
}

/** @deprecated use canUseTranslateGame(pairs) — sheet type alone is not enough. */
export function isTranslateAllowedForSheet(sheetType: SheetType = getPathSheetType()): boolean {
  return sheetType === 'vocab';
}
