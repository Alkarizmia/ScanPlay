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

function distractorPoolFor(target: FluentEmojiArt): FluentEmojiArt[] {
  const others = FLUENT_EMOJI_ART.filter((art) => art.id !== target.id);
  // Colors → other color squares; digits → other keycaps (clearer than random objects).
  if (target.id.endsWith('_square')) {
    const squares = others.filter((a) => a.id.endsWith('_square'));
    if (squares.length >= 3) return squares;
  }
  if (target.id.startsWith('keycap_')) {
    const caps = others.filter((a) => a.id.startsWith('keycap_'));
    if (caps.length >= 3) return caps;
  }
  return others;
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

    const distractors = distractorPoolFor(target);
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
