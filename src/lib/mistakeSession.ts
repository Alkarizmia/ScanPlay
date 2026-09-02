import type { GameMode, WordPair } from '../types';
import { getMistakes } from './mistakes';
import { coercePlayablePairs } from './vocabulary';

export const MISTAKE_SESSION_GAMES: GameMode[] = ['flashcards', 'quiz', 'type'];
export const MIN_MISTAKE_SESSION_PAIRS = 2;

/**
 * The words the learner actually got wrong, oldest mistakes first so a word does not
 * disappear from rotation just because it was missed a long time ago.
 */
export function getMistakePairs(limit = 8): WordPair[] {
  const pending = getMistakes().filter((entry) => !entry.corrected);
  const seen = new Set<string>();
  const pairs: WordPair[] = [];

  for (const entry of pending.reverse()) {
    const key = `${entry.term.toLowerCase()}|${entry.definition.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ term: entry.term, definition: entry.definition });
    if (pairs.length >= limit) break;
  }

  const playable = coercePlayablePairs(pairs);
  return playable.length >= MIN_MISTAKE_SESSION_PAIRS ? playable : pairs;
}

export function canReplayMistakes(): boolean {
  return getMistakePairs(MIN_MISTAKE_SESSION_PAIRS).length >= MIN_MISTAKE_SESSION_PAIRS;
}
