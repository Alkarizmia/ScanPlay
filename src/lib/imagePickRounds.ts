import type { WordPair } from '../types';
import { FLUENT_EMOJI_ART, lookupFluentEmoji, type FluentEmojiArt } from './fluentEmojiArt';
import { seededShuffle } from './seededRandom';
import { coercePlayablePairs } from './vocabulary';

export interface ImagePickRound {
  pairIndex: number;
  prompt: string;
  targetId: string;
  options: FluentEmojiArt[];
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
    const fromTerm = lookupFluentEmoji(pair.term);
    const fromDef = lookupFluentEmoji(pair.definition);
    const target = fromTerm ?? fromDef;
    if (!target) continue;

    const distractors = FLUENT_EMOJI_ART.filter((art) => art.id !== target.id);
    if (distractors.length < 3) continue;

    const picked = seededShuffle(distractors, `${seed}-${i}-d`).slice(0, 3);
    rounds.push({
      pairIndex: i,
      // Always the scanned headword, never the reverse-direction / UI-language gloss.
      prompt: pair.term.trim(),
      targetId: target.id,
      options: seededShuffle([target, ...picked], `${seed}-${i}`),
    });
  }

  return rounds;
}

export function hasEnoughImagePickPairs(pairs: WordPair[]): boolean {
  if (FLUENT_EMOJI_ART.length < 4) return false;
  return buildImagePickRounds(pairs, { maxRounds: 1 }).length >= 1;
}
