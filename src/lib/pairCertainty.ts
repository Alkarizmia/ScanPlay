import type { SheetType, WordPair } from '../types';
import { looksLikeLatex } from './mathText';
import {
  isGarbageVocabTerm,
  isHeadlessOcrFragment,
  looksLikeColumnSplitFragment,
  isSpellingHintDefinition,
  isSectionTitle,
} from './pairQuality';
import { isMathLikeText } from './vocabulary';

export type CertaintySheetKind = SheetType | 'auto';

/** Prose definition cards (science / notions), not formula rows. */
export function looksLikeScienceDefinitionPair(term: string, definition: string): boolean {
  const t = term.trim();
  const d = definition.trim();
  if (!t || !d) return false;
  if (isMathLikeText(t) || isMathLikeText(d) || looksLikeLatex(t) || looksLikeLatex(d)) return false;
  const tw = t.split(/\s+/).filter(Boolean).length;
  const dw = d.split(/\s+/).filter(Boolean).length;
  /* Concept → longer explanation (any language). */
  return tw <= 5 && dw >= 5 && d.length >= 24;
}

function looksTruncatedMath(text: string): boolean {
  const s = text.trim();
  if (!s) return true;
  if (/\\$/.test(s)) return true;
  if (/\{[^}]*$/.test(s) || /\([^)]*$/.test(s) || /\[[^\]]*$/.test(s)) return true;
  if (/(\\frac|\\sqrt|\\sum|\\int)\s*$/i.test(s)) return true;
  return false;
}

function mathIdentifiers(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/[a-zA-ZπΠθΘλΛμΜ]/g)) {
    out.add(m[0]!.toLowerCase());
  }
  for (const m of text.matchAll(/\d+/g)) out.add(m[0]!);
  return out;
}

function assessMathPair(term: string, definition: string): 'trusted' | 'uncertain' {
  if (looksTruncatedMath(term) || looksTruncatedMath(definition)) return 'uncertain';
  if (term.toLowerCase() === definition.toLowerCase()) return 'uncertain';
  const termMath = isMathLikeText(term) || looksLikeLatex(term);
  const defMath = isMathLikeText(definition) || looksLikeLatex(definition);
  /* Name → formula is fine (ex. "dérivée de x²" → "2x"). */
  if (termMath && defMath) {
    const a = mathIdentifiers(term);
    const b = mathIdentifiers(definition);
    if (a.size >= 2 && b.size >= 2) {
      let shared = 0;
      for (const id of a) if (b.has(id)) shared += 1;
      if (shared === 0) return 'uncertain';
    }
  }
  return 'trusted';
}

function assessSciencePair(term: string, definition: string): 'trusted' | 'uncertain' {
  /* Same-language concept→definition is normal. Do not apply vocab bilingual rules. */
  if (isSectionTitle(term) || isSectionTitle(definition)) return 'uncertain';
  if (isGarbageVocabTerm(term)) return 'uncertain';
  if (definition.trim().length < 8) return 'uncertain';
  if (term.toLowerCase() === definition.toLowerCase()) return 'uncertain';
  return 'trusted';
}

function assessVocabPair(term: string, definition: string): 'trusted' | 'uncertain' {
  if (looksLikeColumnSplitFragment(term, definition)) return 'uncertain';
  if (isHeadlessOcrFragment(term) || isHeadlessOcrFragment(definition)) return 'uncertain';
  if (isSpellingHintDefinition(definition)) return 'uncertain';
  if (isGarbageVocabTerm(term) || isGarbageVocabTerm(definition)) return 'uncertain';
  if (isSectionTitle(term) || isSectionTitle(definition)) return 'uncertain';
  if (term.length <= 1 || definition.length <= 1) return 'uncertain';
  return 'trusted';
}

/**
 * Language-agnostic certainty for a single card.
 * Math and science use different rules so formula sheets are not scored like vocab,
 * and science definitions are not treated as bilingual vocab.
 */
export function inferPairQuality(
  pair: Pick<WordPair, 'term' | 'definition' | 'faces' | 'quality'>,
  sheetKind: CertaintySheetKind = 'auto',
): 'trusted' | 'uncertain' {
  if (pair.quality === 'uncertain') return 'uncertain';

  const term = pair.term?.trim() ?? '';
  const definition = pair.definition?.trim() ?? '';
  if (!term || !definition) return 'uncertain';

  const facesOk = (pair.faces ?? []).some((f) => f.trim().length > 0);
  void facesOk;

  const forcedMath = sheetKind === 'math';
  const forcedScience = sheetKind === 'definitions' || sheetKind === 'notes';
  const mathLike =
    forcedMath || isMathLikeText(term) || isMathLikeText(definition) || looksLikeLatex(term) || looksLikeLatex(definition);

  if (mathLike && !forcedScience) {
    return assessMathPair(term, definition);
  }
  if (forcedScience || looksLikeScienceDefinitionPair(term, definition)) {
    return assessSciencePair(term, definition);
  }
  return assessVocabPair(term, definition);
}

/** Re-apply certainty flags without wiping an existing uncertain mark. */
export function applyPairCertainty<T extends WordPair>(
  pairs: T[],
  sheetKind: CertaintySheetKind = 'auto',
): T[] {
  return pairs.map((pair) => {
    const quality = inferPairQuality(pair, sheetKind);
    if (quality === pair.quality) return pair;
    return { ...pair, quality };
  });
}
