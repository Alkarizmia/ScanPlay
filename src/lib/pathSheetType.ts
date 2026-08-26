import type { LangCode, SheetType, WordPair } from '../types';
import { detectLang } from './columnParser';
import { looksLikeLatex } from './mathText';
import { isMathLikeText } from './vocabulary';

let currentSheetType: SheetType = 'vocab';

export function setPathSheetType(sheetType: SheetType): void {
  currentSheetType = sheetType;
}

export function getPathSheetType(): SheetType {
  return currentSheetType;
}

/** Oral / speak games only for vocab lists and course notes — not formulas or Q/A definitions. */
export function isOralAllowedForSheet(sheetType: SheetType = getPathSheetType()): boolean {
  return sheetType === 'vocab' || sheetType === 'notes';
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

/** Phrase tiles: bilingual vocab only — never maths, never same-language course notes. */
export function canUseTranslateGame(
  pairs: WordPair[],
  sheetType: SheetType = getPathSheetType(),
): boolean {
  if (sheetType !== 'vocab') return false;
  if (pairs.length === 0) return false;
  const mathHits = pairs.filter(pairLooksLikeMathCourse).length;
  if (mathHits >= Math.max(1, Math.ceil(pairs.length * 0.35))) return false;
  const langs = inferColumnLangs(pairs);
  if (langs.term === 'unknown' || langs.def === 'unknown') return false;
  return langs.term !== langs.def;
}

/** @deprecated use canUseTranslateGame(pairs) — sheet type alone is not enough. */
export function isTranslateAllowedForSheet(sheetType: SheetType = getPathSheetType()): boolean {
  return sheetType === 'vocab';
}
