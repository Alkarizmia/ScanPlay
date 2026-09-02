import type { WordPair } from '../types';
import { coercePlayablePairs, isMathLikeText } from './vocabulary';

/** Words you can reasonably be asked to spell from hearing them once. */
export function getDictationPool(pairs: WordPair[]): WordPair[] {
  return coercePlayablePairs(pairs).filter((pair) => {
    const term = pair.term.trim();
    if (term.length < 2 || term.length > 28) return false;
    if (term.split(/\s+/).length > 3) return false;
    return !isMathLikeText(term);
  });
}

export function hasEnoughDictationPairs(pairs: WordPair[]): boolean {
  return getDictationPool(pairs).length >= 2;
}
