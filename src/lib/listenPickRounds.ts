import type { LangCode, WordPair } from '../types';
import { resolveSpeakLang } from './speakLang';
import { seededShuffle } from './seededRandom';
import { coercePlayablePairs, isMathLikeText } from './vocabulary';

export interface ListenPickRound {
  pairIndex: number;
  /** The word actually spoken. */
  target: string;
  lang: LangCode;
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

/** Short single words only — a spoken sentence is not a discrimination exercise. */
function isPickable(pair: WordPair): boolean {
  const term = pair.term.trim();
  if (term.length < 2 || term.length > 24) return false;
  if (term.split(/\s+/).length > 2) return false;
  return !isMathLikeText(term);
}

/**
 * Distractors that sound plausible: closest spelling first, so the learner has to
 * actually hear the difference instead of eliminating by shape.
 */
function pickDistractors(target: string, candidates: string[], count: number): string[] {
  const normalizedTarget = normalize(target);
  return candidates
    .filter((word) => normalize(word) !== normalizedTarget)
    .map((word) => ({ word, score: distance(normalize(word), normalizedTarget) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map((entry) => entry.word);
}

export function buildListenPickRounds(
  pairs: WordPair[],
  options: { maxRounds?: number; seed?: string } = {},
): ListenPickRound[] {
  const { maxRounds = 6, seed = 'listenpick' } = options;
  const pool = coercePlayablePairs(pairs).filter(isPickable);
  if (pool.length < MIN_CANDIDATES) return [];

  const words = [...new Set(pool.map((p) => p.term.trim()))];
  if (words.length < MIN_CANDIDATES) return [];

  const rounds: ListenPickRound[] = [];
  for (let i = 0; i < pool.length && rounds.length < maxRounds; i++) {
    const pair = pool[i]!;
    const target = pair.term.trim();
    const distractors = pickDistractors(target, words, 3);
    if (distractors.length < 3) continue;

    rounds.push({
      pairIndex: i,
      target,
      lang: resolveSpeakLang(pair),
      options: seededShuffle([target, ...distractors], `${seed}-${i}`),
    });
  }

  return rounds;
}

export function hasEnoughListenPickPairs(pairs: WordPair[]): boolean {
  return buildListenPickRounds(pairs, { maxRounds: 2 }).length >= 2;
}
