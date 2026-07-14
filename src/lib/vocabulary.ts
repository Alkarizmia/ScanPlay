import type { PairDirection, WordPair } from '../types';
import { seededShuffle } from './seededRandom';
import { enrichPairsWithVisuals } from './wordVisuals';
import {
  isGarbageVocabTerm,
  isPlayableDefinition,
  isSectionTitle,
  isSpellingHintDefinition,
  isTrueFalseSuitable,
} from './pairQuality';

const INSTRUCTION_PATTERNS = [
  /\blet op\b/i,
  /\battention\b/i,
  /\bjongeren\b/i,
  /\bimportant\b/i,
  /\bnote\s*:/i,
  /\bexercice\s*\d/i,
  /\b(?:page|blad)\s+\d+/i,
  /\bun peu de\b/i,
  /\bliste de\b/i,
];

/** Fix frequent OCR truncations and fused articles (dezoon → de zoon, lefils → le fils). */
export function fixOcrLine(line: string): string {
  let s = line
    .replace(/\bcela ne r[eé]ussit pa\b/gi, 'cela ne réussit pas')
    .replace(/\b(r[eé]ussit)\s+pa(\s*[.,!?]|$)/gi, '$1 pas$2')
    .replace(/\bne\s+pa(\s*[.,!?]|$)/gi, 'ne pas$1');

  // Fused NL/FR articles glued to the next word (common on phone OCR).
  s = s.replace(/\b(de|het|een|le|la|les|un|une)([a-zàâäéèêëïîôùûüçœæ])/gi, '$1 $2');
  s = s.replace(/^(de|het|le|la|les|un|une)([a-zàâäéèêëïîôùûüçœæ])/i, '$1 $2');

  return s.replace(/\s{2,}/g, ' ').trim();
}

export function isInstructionText(text: string): boolean {
  const cleaned = text.trim();
  if (!cleaned) return true;
  if (INSTRUCTION_PATTERNS.some((p) => p.test(cleaned))) return true;

  const letters = cleaned.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && letters.length >= 6 && letters === letters.toUpperCase()) {
    return true;
  }

  if (/\bpa\s*$/.test(cleaned) && !/\bpas\s*$/.test(cleaned) && /\b(ne|réussit|reussit)\b/i.test(cleaned)) {
    return true;
  }

  return false;
}

/** Detect OCR garbage like "loin pdr flic snes". */
export function isOcrGarbage(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  let weird = 0;
  for (const w of words) {
    const core = w.replace(/[^a-zA-Zàâäéèêëïîôùûü]/g, '');
    if (core.length < 2) continue;
    const vowels = (core.match(/[aeiouyàâäéèêëïîôùûü]/gi) || []).length;
    if (core.length >= 3 && vowels === 0) weird += 1;
    if (core.length <= 4 && vowels === 0 && core.length >= 3) weird += 1;
    if (/^[a-z]{2,3}$/i.test(core) && vowels === 0) weird += 1;
  }

  if (words.length >= 2 && weird >= Math.ceil(words.length * 0.5)) return true;
  if (words.length >= 3 && weird >= 2) return true;
  return false;
}

function coreWord(text: string): string {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/^(de|het|een|le|la|les|un|une|the|a|an)\s+/i, '')
    .trim();
}

/** Reject pairs that overlap or look like OCR column bleed. */
export function isCoherentPair(pair: WordPair): boolean {
  const termCore = coreWord(pair.term);
  const defCore = coreWord(pair.definition);

  if (!termCore || !defCore) return false;
  if (termCore === defCore) return false;
  if (isOcrGarbage(pair.term) || isOcrGarbage(pair.definition)) return false;

  if (termCore.length >= 3 && defCore.includes(termCore)) return false;
  if (defCore.length >= 3 && termCore.includes(defCore)) return false;

  const termTokens = termCore.split(/\s+/);
  const defTokens = defCore.split(/\s+/);
  const shared = termTokens.filter((t) => t.length > 2 && defTokens.includes(t));
  if (shared.length > 0 && shared.length >= Math.min(termTokens.length, defTokens.length)) {
    return false;
  }

  if (isInstructionText(pair.term) || isInstructionText(pair.definition)) return false;
  if (isGarbageVocabTerm(pair.term) || isGarbageVocabTerm(pair.definition)) return false;
  if (isSectionTitle(pair.term) || isSectionTitle(pair.definition)) return false;
  if (isSpellingHintDefinition(pair.definition)) return false;
  if (!isPlayableDefinition(pair.definition, pair.term)) return false;

  const defWords = pair.definition.split(/\s+/).length;
  if (defWords > 10) return false;

  if ((pair.definition.match(/,/g) || []).length >= 2 && pair.definition.length < 45) return false;

  return true;
}

export const MIN_QUIZ_PAIRS = 4;
export const MIN_QUIZ_PAIRS_RELAXED = 2;
export const MIN_MATCH_PAIRS = 2;

export function isMathLikeText(text: string): boolean {
  return /[=+\-×÷*/^√∫∑]|\\frac|[0-9]\s*[+\-*/^]|[a-z]\s*=\s*[^=]/i.test(text);
}

export function isValidVocabPair(pair: WordPair, options?: { mathSheet?: boolean }): boolean {
  if (pair.term.length < 2 || pair.definition.length < 2) return false;
  if (options?.mathSheet || isMathLikeText(pair.term) || isMathLikeText(pair.definition)) {
    if (pair.term.length > 80 || pair.definition.length > 140) return false;
    if (pair.term.toLowerCase() === pair.definition.toLowerCase()) return false;
    return true;
  }
  if (pair.term.length > 55 || pair.definition.length > 120) return false;
  if (pair.term.split(/\s+/).length > 6 || pair.definition.split(/\s+/).length > 10) return false;
  return isCoherentPair(pair);
}

export function sanitizePairs(pairs: WordPair[], options?: { mathSheet?: boolean }): WordPair[] {
  const seen = new Set<string>();
  const filtered = pairs.filter((p) => {
    if (!isValidVocabPair(p, options)) return false;
    const key = `${coreWord(p.term)}|${coreWord(p.definition)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return enrichPairsWithVisuals(filtered);
}

/** Quiz pool: strict first, then relaxed playable pairs for path steps. */
export function getQuizPool(pairs: WordPair[]): WordPair[] {
  const strict = filterQuizPool(pairs);
  if (strict.length >= MIN_QUIZ_PAIRS_RELAXED) return strict;

  const relaxed = coercePlayablePairs(pairs).filter(
    (p) =>
      p.term.length >= 2 &&
      p.definition.length >= 2 &&
      !isInstructionText(p.term) &&
      !isInstructionText(p.definition) &&
      !isGarbageVocabTerm(p.term) &&
      isPlayableDefinition(p.definition, p.term),
  );
  return relaxed;
}

export function normalizeTypedAnswer(raw: string, mathLike = false): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (mathLike) return normalizeMathExpression(trimmed);
  return trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Formule maths : sans espaces, primes unifiées, opérateurs × · * unifiés. */
function normalizeMathExpression(raw: string): string {
  return raw
    .trim()
    .replace(/\u2032/g, "'")
    .replace(/[×·⋅∙]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** Prend la partie après le dernier = si l'utilisateur ne tape que le résultat. */
function extractMathAnswerSide(text: string): string {
  const eq = text.lastIndexOf('=');
  if (eq >= 0) return text.slice(eq + 1).trim();
  return text.trim();
}

function mathAnswersMatch(typed: string, expected: string): boolean {
  const typedSides = [
    normalizeMathExpression(typed),
    normalizeMathExpression(extractMathAnswerSide(typed)),
  ].filter(Boolean);
  const expectedSides = [
    normalizeMathExpression(expected),
    normalizeMathExpression(extractMathAnswerSide(expected)),
  ].filter(Boolean);

  const uniqueExpected = [...new Set(expectedSides)];
  const uniqueTyped = [...new Set(typedSides)];

  return uniqueTyped.some((a) => uniqueExpected.some((b) => a === b));
}

export function answersMatch(typed: string, expected: string, mathLike = false): boolean {
  const a = normalizeTypedAnswer(typed, mathLike);
  const b = normalizeTypedAnswer(expected, mathLike);
  if (!a || !b) return false;
  if (a === b) return true;
  if (mathLike) return mathAnswersMatch(typed, expected);
  return false;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return row[b.length];
}

/** Petite faute (1 lettre, accent déjà normalisé) → demi-points. */
export function isNearMatch(typed: string, expected: string, mathLike = false): boolean {
  if (mathLike || answersMatch(typed, expected, mathLike)) return false;
  const a = normalizeTypedAnswer(typed, mathLike);
  const b = normalizeTypedAnswer(expected, mathLike);
  if (!a || !b) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length >= 3 && b.length >= 3 && levenshtein(a, b) === 1) return true;
  return false;
}

export type AnswerGrade = 'correct' | 'near' | 'wrong';

/** Réponses trop longues pour être tapées mot à mot → QCM 4 choix. */
export const LONG_ANSWER_CHAR_THRESHOLD = 40;
export const LONG_ANSWER_WORD_THRESHOLD = 6;

const SEMANTIC_STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'd', 'l', 'en', 'au', 'aux',
  'par', 'dans', 'sur', 'avec', 'pour', 'et', 'ou', 'que', 'qui', 'est', 'sont', 'ce',
  'the', 'a', 'an', 'of', 'in', 'on', 'to', 'and', 'or', 'by', 'for', 'is', 'are',
  'het', 'de', 'een', 'van', 'in', 'op', 'met', 'voor', 'en', 'of', 'is', 'zijn',
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'y', 'o', 'por', 'para',
]);

export function isLongExpectedAnswer(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length >= LONG_ANSWER_CHAR_THRESHOLD) return true;
  return trimmed.split(/\s+/).filter(Boolean).length >= LONG_ANSWER_WORD_THRESHOLD;
}

function significantWords(text: string): string[] {
  return normalizeTypedAnswer(text, false)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !SEMANTIC_STOP_WORDS.has(w));
}

function wordsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.includes(a)) return true;
  if (b.length >= 4 && a.includes(b)) return true;
  if (a.length >= 4 && b.length >= 4 && levenshtein(a, b) <= 1) return true;
  return false;
}

/** Comprend le sens (mots-clés) sans exiger la phrase entière. */
function gradeSemanticAnswer(typed: string, expected: string): AnswerGrade {
  const typedWords = significantWords(typed);
  const expectedWords = significantWords(expected);
  if (typedWords.length === 0 || expectedWords.length === 0) return 'wrong';

  const matchedExpected = expectedWords.filter((ew) =>
    typedWords.some((tw) => wordsOverlap(tw, ew)),
  );
  const coverage = matchedExpected.length / expectedWords.length;

  if (coverage >= 0.55 && typedWords.length >= 2) return 'correct';
  if (coverage >= 0.35 && matchedExpected.length >= 2) return 'near';
  if (expectedWords.length <= 2 && matchedExpected.length >= 1 && typedWords.length <= 4) {
    return matchedExpected.length >= expectedWords.length ? 'correct' : 'near';
  }

  const normTyped = normalizeTypedAnswer(typed, false);
  const normExpected = normalizeTypedAnswer(expected, false);
  if (normTyped.length >= 8 && normExpected.includes(normTyped)) return 'correct';
  if (normTyped.length >= 8 && normExpected.split(/\s+/).some((chunk) => chunk.length >= 5 && normTyped.includes(chunk))) {
    return 'near';
  }

  return 'wrong';
}

export function isValidTypeDistractor(term: string, definition: string, correctDefinition: string): boolean {
  if (!definition || definition === correctDefinition || definition.length < 3) return false;
  if (isInstructionText(definition) || isOcrGarbage(definition)) return false;

  const termCore = coreWord(term);
  const defCore = coreWord(definition);
  if (termCore.length >= 3 && defCore.includes(termCore)) return false;
  if (termCore === defCore) return false;

  return true;
}

export function pickTypeGameOptions(
  correct: WordPair,
  pool: WordPair[],
  distractorCount = 3,
  seed?: string,
): string[] {
  const wrong = pool
    .filter((p) => p.definition !== correct.definition)
    .filter((p) => isValidTypeDistractor(correct.term, p.definition, correct.definition))
    .map((p) => p.definition);

  const unique = [...new Set(wrong)];
  const mix = (arr: string[]) => (seed ? seededShuffle(arr, `${seed}-type-opts-${correct.term}`) : shuffle(arr));
  const picks = mix(unique).slice(0, distractorCount);

  return mix([correct.definition, ...picks]);
}

export function gradeTypedAnswer(typed: string, expected: string, mathLike = false): AnswerGrade {
  if (answersMatch(typed, expected, mathLike)) return 'correct';
  if (isNearMatch(typed, expected, mathLike)) return 'near';
  if (!mathLike) {
    const semantic = gradeSemanticAnswer(typed, expected);
    if (semantic !== 'wrong') return semantic;
  }
  return 'wrong';
}

export function flipPair(pair: WordPair): WordPair {
  return {
    term: pair.definition,
    definition: pair.term,
    termLang: pair.defLang,
    defLang: pair.termLang,
    visual: pair.visual,
  };
}

export function isReversedStep(stepIndex: number | null, direction: PairDirection): boolean {
  if (direction === 'reverse') return true;
  if (direction === 'forward') return false;
  return stepIndex !== null && stepIndex % 2 === 1;
}

export function getPlayPairs(
  pairs: WordPair[],
  stepIndex: number | null,
  direction: PairDirection,
): WordPair[] {
  if (!isReversedStep(stepIndex, direction)) return pairs;
  return pairs.map(flipPair);
}

/** Strict filter for quiz — never use raw unfiltered pairs. */
export function filterQuizPool(pairs: WordPair[]): WordPair[] {
  return sanitizePairs(pairs).filter(
    (p) => !isGarbageVocabTerm(p.term) && isPlayableDefinition(p.definition, p.term),
  );
}

export function hasEnoughQuizPairsRelaxed(pairs: WordPair[]): boolean {
  return getQuizPool(pairs).length >= MIN_QUIZ_PAIRS_RELAXED;
}

export function hasEnoughTrueFalsePairs(pairs: WordPair[]): boolean {
  if (!isTrueFalseSuitable(pairs)) return false;
  return getQuizPool(pairs).length >= MIN_QUIZ_PAIRS_RELAXED;
}

export function hasEnoughMatchPairs(pairs: WordPair[]): boolean {
  return coercePlayablePairs(pairs).length >= MIN_MATCH_PAIRS;
}

export function hasEnoughQuizPairs(pairs: WordPair[]): boolean {
  return filterQuizPool(pairs).length >= MIN_QUIZ_PAIRS;
}

export function isValidQuizDistractor(term: string, definition: string): boolean {
  if (!definition || definition.length < 2 || definition.length > 100) return false;
  if (isInstructionText(definition) || isOcrGarbage(definition)) return false;
  if (definition.split(/\s+/).length > 8) return false;

  const termCore = coreWord(term);
  const defCore = coreWord(definition);
  if (termCore.length >= 3 && defCore.includes(termCore)) return false;
  if (termCore === defCore) return false;

  return true;
}

export function pickQuizOptions(
  correct: WordPair,
  pool: WordPair[],
  count = 3,
  seed?: string,
): string[] {
  const wrong = pool
    .filter((p) => p.definition !== correct.definition)
    .filter((p) => isValidQuizDistractor(correct.term, p.definition))
    .map((p) => p.definition);

  const unique = [...new Set(wrong)];
  const mix = (arr: string[]) => (seed ? seededShuffle(arr, `${seed}-opts-${correct.term}`) : shuffle(arr));
  const picks = mix(unique).slice(0, count);

  return mix([correct.definition, ...picks]);
}

/** Enough clean pairs to start a path (adaptive modes per step). */
export function canOpenGamePath(pairs: WordPair[]): boolean {
  const playable = coercePlayablePairs(pairs);
  return playable.length >= 2;
}

/** Lighter filter when strict sanitize removes everything but raw pairs exist. */
export function coercePlayablePairs(raw: WordPair[]): WordPair[] {
  const strict = sanitizePairs(raw);
  if (strict.length > 0) return strict;

  const seen = new Set<string>();
  const filtered = raw.filter((p) => {
    if (p.term.length < 2 || p.definition.length < 2) return false;
    if (isInstructionText(p.term) || isInstructionText(p.definition)) return false;
    const mathLike = isMathLikeText(p.term) || isMathLikeText(p.definition);
    if (!mathLike && (isOcrGarbage(p.term) || isOcrGarbage(p.definition))) return false;
    if (p.term.toLowerCase() === p.definition.toLowerCase()) return false;
    const key = `${p.term.toLowerCase()}|${p.definition.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return enrichPairsWithVisuals(filtered);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
