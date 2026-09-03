import type { WordPair } from '../types';
import { CARTOON_ART, lookupCartoonArt, type CartoonArt } from './cartoonArt';
import { seededShuffle } from './seededRandom';
import { coercePlayablePairs } from './vocabulary';

export interface ImagePickRound {
  pairIndex: number;
  prompt: string;
  targetId: string;
  options: CartoonArt[];
}

export function buildImagePickRounds(
  pairs: WordPair[],
  options: { maxRounds?: number; seed?: string } = {},
): ImagePickRound[] {
  const { maxRounds = 4, seed = 'imagepick' } = options;
  const pool = coercePlayablePairs(pairs);
  const rounds: ImagePickRound[] = [];

  for (let i = 0; i < pool.length && rounds.length < maxRounds; i++) {
    const pair = pool[i]!;
    const fromTerm = lookupCartoonArt(pair.term);
    const fromDef = lookupCartoonArt(pair.definition);
    const target = fromTerm ?? fromDef;
    if (!target) continue;

    const distractors = CARTOON_ART.filter((art) => art.id !== target.id);
    if (distractors.length < 3) continue;

    const picked = seededShuffle(distractors, `${seed}-${i}-d`).slice(0, 3);
    rounds.push({
      pairIndex: i,
      prompt: (fromTerm ? pair.term : pair.definition).trim(),
      targetId: target.id,
      options: seededShuffle([target, ...picked], `${seed}-${i}`),
    });
  }

  return rounds;
}

export function hasEnoughImagePickPairs(pairs: WordPair[]): boolean {
  if (CARTOON_ART.length < 4) return false;
  return buildImagePickRounds(pairs, { maxRounds: 1 }).length >= 1;
}
