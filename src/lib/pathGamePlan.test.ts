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

describe('getNextGameForStep technical oral', () => {
  it('does not force speak replay after technical skip', () => {
    const games = pickPathStepGames(0, pairs);
    expect(games).toContain('speak');

    let progress = mergeSubGameResult({}, 0, 'speak', TECHNICAL_PCT, pairs);
    for (const mode of games) {
      if (mode === 'speak') continue;
      progress = mergeSubGameResult(progress, 0, mode, 100, pairs);
    }

    expect(getNextGameForStep(0, progress, pairs)).toBeNull();
  });

  it('still offers unfinished games before advancing', () => {
    const games = pickPathStepGames(0, pairs);
    const other = games.find((g) => g !== 'speak');
    expect(other).toBeTruthy();

    const progress = mergeSubGameResult({}, 0, 'speak', TECHNICAL_PCT, pairs);
    expect(getNextGameForStep(0, progress, pairs)).toBe(other);
  });
});
