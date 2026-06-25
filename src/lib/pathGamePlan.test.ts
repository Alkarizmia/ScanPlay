import { describe, expect, it } from 'vitest';
import type { WordPair } from '../types';
import { getNextGameForStep, pickPathStepGames } from './pathGamePlan';
import { TECHNICAL_PCT, mergeSubGameResult } from './stepProgress';

const pairs: WordPair[] = [
  { term: 'beat', definition: 'battre' },
  { term: 'run', definition: 'courir' },
  { term: 'walk', definition: 'marcher' },
  { term: 'jump', definition: 'sauter' },
];

describe('getNextGameForStep listen path', () => {
  it('includes listen in oral lesson templates', () => {
    const games = pickPathStepGames(6, pairs);
    expect(games).toContain('listen');

    let progress = mergeSubGameResult({}, 6, 'listen', TECHNICAL_PCT, pairs);
    for (const mode of games) {
      if (mode === 'listen') continue;
      progress = mergeSubGameResult(progress, 6, mode, 100, pairs);
    }

    expect(getNextGameForStep(6, progress, pairs)).toBeNull();
  });

  it('still offers unfinished games before advancing', () => {
    const games = pickPathStepGames(6, pairs);
    const other = games.find((g) => g !== 'listen');
    expect(other).toBeTruthy();

    const progress = mergeSubGameResult({}, 6, 'listen', TECHNICAL_PCT, pairs);
    expect(getNextGameForStep(6, progress, pairs)).toBe(other);
  });
});
