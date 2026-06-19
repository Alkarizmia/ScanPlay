import { describe, expect, it } from 'vitest';
import type { StepProgressMap, WordPair } from '../types';
import { pickPathStepGames } from './pathGamePlan';
import { canPlayStep, getTierFromPct, mergeSubGameResult } from './stepProgress';

describe('getTierFromPct', () => {
  it('returns null for technical sentinel', () => {
    expect(getTierFromPct(-1)).toBe(null);
  });

  it('gold at 100%', () => {
    expect(getTierFromPct(100)).toBe('gold');
  });

  it('iron from 70% to 99%', () => {
    expect(getTierFromPct(99)).toBe('iron');
    expect(getTierFromPct(70)).toBe('iron');
  });

  it('bronze below 70%', () => {
    expect(getTierFromPct(69)).toBe('bronze');
    expect(getTierFromPct(0)).toBe('bronze');
  });
});

describe('canPlayStep gold replay', () => {
  const pairs: WordPair[] = [
    { term: 'a', definition: '1' },
    { term: 'b', definition: '2' },
    { term: 'c', definition: '3' },
    { term: 'd', definition: '4' },
  ];

  it('allows replay when node is all gold', () => {
    const games = pickPathStepGames(0, pairs);
    const progress: StepProgressMap = {
      0: {
        pct: 100,
        tier: 'gold',
        games: Object.fromEntries(games.map((g) => [g, { pct: 100, tier: 'gold' as const }])),
      },
    };

    expect(canPlayStep(0, progress, { pairs, totalSteps: 3 })).toBe(true);
  });
});

describe('mergeSubGameResult gold replay', () => {
  const pairs: WordPair[] = [
    { term: 'a', definition: '1' },
    { term: 'b', definition: '2' },
    { term: 'c', definition: '3' },
    { term: 'd', definition: '4' },
  ];

  it('keeps gold when replay scores 0%', () => {
    const games = pickPathStepGames(0, pairs);
    const mode = games[0];
    const progress: StepProgressMap = {
      0: {
        pct: 100,
        tier: 'gold',
        games: Object.fromEntries(games.map((g) => [g, { pct: 100, tier: 'gold' as const }])),
      },
    };

    const next = mergeSubGameResult(progress, 0, mode, 0, pairs);
    expect(next).toBe(progress);
    expect(next[0]?.pct).toBe(100);
    expect(next[0]?.tier).toBe('gold');
    expect(next[0]?.games?.[mode]?.pct).toBe(100);
  });
});
