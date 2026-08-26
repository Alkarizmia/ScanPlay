import { describe, expect, it } from 'vitest';
import { addPendingTime, checkpointMatches } from './lessonCheckpoint';
import type { LessonCheckpoint } from './lessonCheckpoint';
import { getResumeGameIndex, pickPathStepGames } from './pathGamePlan';
import { mergeSubGameResult } from './stepProgress';
import type { WordPair } from '../types';

const pairs: WordPair[] = [
  { term: 'a', definition: '1' },
  { term: 'b', definition: '2' },
  { term: 'c', definition: '3' },
  { term: 'd', definition: '4' },
];

describe('getResumeGameIndex', () => {
  it('starts at 0 when nothing is done', () => {
    expect(getResumeGameIndex(0, {}, pairs)).toBe(0);
  });

  it('skips finished mini-games in the node', () => {
    const games = pickPathStepGames(0, pairs);
    const first = games[0]!;
    const progress = mergeSubGameResult({}, 0, first, 80, pairs);
    expect(getResumeGameIndex(0, progress, pairs)).toBe(1);
  });
});

describe('lesson checkpoint time', () => {
  it('adds previous pending time to later play', () => {
    const ck: LessonCheckpoint = {
      deckId: 'd',
      stepIndex: 0,
      nextGameIndex: 1,
      pendingMs: 4000,
      games: [],
      startedAt: 1,
      pairShift: 0,
    };
    expect(addPendingTime(ck, 2500).pendingMs).toBe(6500);
    expect(checkpointMatches(ck, 'd', 0)).toBe(true);
    expect(checkpointMatches(ck, 'other', 0)).toBe(false);
  });
});
