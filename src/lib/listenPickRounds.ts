import type { LangCode, WordPair } from '../types';
import { pairHasDistinctLangs, resolveSideLang } from './speakLang';
import { seededShuffle } from './seededRandom';
import { pickVocabToken, splitVocabAlternatives } from './vocabTokens';
import { coercePlayablePairs, isMathLikeText } from './vocabulary';

export interface ListenPickRound {
  pairIndex: number;
  /** Word actually spoken — never the same language as the options. */
  spoken: string;
  lang: LangCode;
  /** Correct option (translation / other side). */
  target: string;
  options: string[];
}

const MIN_CANDIDATES = 4;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim();
}

function distance(a: string, b: string): number {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length]!;
}

function isShortVocab(text: string): boolean {
  return splitVocabAlternatives(text).some((token) => {
    const term = token.trim();
    if (term.length < 2 || term.length > 24) return false;
    if (term.split(/\s+/).length > 2) return false;
    return !isMathLikeText(term);
  });
}

function isPickable(pair: WordPair): boolean {
  return pairHasDistinctLangs(pair) && isShortVocab(pair.term) && isShortVocab(pair.definition);
}

function pickDistractors(target: string, candidates: string[], count: number): string[] {
  const normalizedTarget = normalize(target);
  return candidates
    .filter((word) => normalize(word) !== normalizedTarget)
    .map((word) => ({ word, score: distance(normalize(word), normalizedTarget) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map((entry) => entry.word);
}

function uniqueTokens(values: string[]): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const value of values) {
    const token = splitVocabAlternatives(value)[0]?.trim() ?? value.trim();
    const key = normalize(token);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    tokens.push(token);
  }
  return tokens;
}

/**
 * Hear language A, pick the matching scanned word in language B.
 * Direction alternates so audio and options are never the same language.
 */
export function buildListenPickRounds(
  pairs: WordPair[],
  options: { maxRounds?: number; seed?: string } = {},
): ListenPickRound[] {
  const { maxRounds = 6, seed = 'listenpick' } = options;
  const playable = coercePlayablePairs(pairs);
  const pool = playable.filter(isPickable);
  if (pool.length < MIN_CANDIDATES) return [];

  const termTokens = uniqueTokens(pool.map((p) => p.term));
  const defTokens = uniqueTokens(pool.map((p) => p.definition));

  const rounds: ListenPickRound[] = [];
  for (let i = 0; i < pool.length && rounds.length < maxRounds; i++) {
    const pair = pool[i]!;
    const hearTerm = i % 2 === 0;
    const spokenSide = hearTerm ? pair.term : pair.definition;
    const answerSide = hearTerm ? pair.definition : pair.term;
    const spoken = pickVocabToken(spokenSide, `${seed}-spoken-${i}`);
    const target = splitVocabAlternatives(answerSide)[0]?.trim() ?? answerSide.trim();
    const candidates = hearTerm ? defTokens : termTokens;
    const distractors = pickDistractors(target, candidates, 3);
    if (distractors.length < 3) continue;

    const spokenLang = resolveSideLang(pair, hearTerm ? 'term' : 'def');
    const answerLang = resolveSideLang(pair, hearTerm ? 'def' : 'term');
    if (spokenLang !== 'unknown' && answerLang !== 'unknown' && spokenLang === answerLang) {
      continue;
    }

    rounds.push({
      pairIndex: playable.indexOf(pair),
      spoken,
      lang: spokenLang,
      target,
      options: seededShuffle([target, ...distractors], `${seed}-${i}`),
    });
  }

  return rounds;
}

export function hasEnoughListenPickPairs(pairs: WordPair[]): boolean {
  return buildListenPickRounds(pairs, { maxRounds: 2 }).length >= 2;
}
