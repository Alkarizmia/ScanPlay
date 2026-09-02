import type { WordPair } from '../types';
import { seededShuffle } from './seededRandom';
import { coercePlayablePairs, isMathLikeText } from './vocabulary';

export interface ReorderTile {
  id: string;
  text: string;
}

export interface ReorderRound {
  pairIndex: number;
  /** The side shown as the clue (the other side is rebuilt word by word). */
  clue: string;
  expected: string[];
  tiles: ReorderTile[];
}

const MIN_WORDS = 4;
const MAX_WORDS = 10;

function tokenize(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** The sentence-like side of a pair — works for notes sheets, not only bilingual ones. */
export function pickReorderSource(pair: WordPair): { clue: string; sentence: string } | null {
  if (isMathLikeText(pair.term) || isMathLikeText(pair.definition)) return null;

  const defWords = tokenize(pair.definition);
  if (defWords.length >= MIN_WORDS && defWords.length <= MAX_WORDS) {
    return { clue: pair.term, sentence: pair.definition };
  }

  const termWords = tokenize(pair.term);
  if (termWords.length >= MIN_WORDS && termWords.length <= MAX_WORDS) {
    return { clue: pair.definition, sentence: pair.term };
  }

  return null;
}

export function buildReorderRounds(
  pairs: WordPair[],
  options: { maxRounds?: number; seed?: string } = {},
): ReorderRound[] {
  const { maxRounds = 5, seed = 'reorder' } = options;
  const pool = coercePlayablePairs(pairs);
  const rounds: ReorderRound[] = [];

  for (let i = 0; i < pool.length && rounds.length < maxRounds; i++) {
    const pair = pool[i]!;
    const source = pickReorderSource(pair);
    if (!source) continue;

    const expected = tokenize(source.sentence);
    const tiles = expected.map((text, tileIndex) => ({ id: `${i}-${tileIndex}`, text }));

    let shuffled = seededShuffle(tiles, `${seed}-${i}`);
    // A pre-solved bank is not a puzzle: nudge it until the order differs.
    for (let attempt = 1; attempt < 4; attempt++) {
      const same = shuffled.every((tile, k) => tile.text === expected[k]);
      if (!same) break;
      shuffled = seededShuffle(tiles, `${seed}-${i}-${attempt}`);
    }

    rounds.push({ pairIndex: i, clue: source.clue.trim(), expected, tiles: shuffled });
  }

  return rounds;
}

export function hasEnoughReorderPairs(pairs: WordPair[]): boolean {
  return buildReorderRounds(pairs, { maxRounds: 2 }).length >= 2;
}
