import { describe, expect, it } from 'vitest';
import {
  activeUniverseWeakWords,
  coerceUniverseEnglishProfile,
  mergeUniverseEnglishProfiles,
  type UniverseEnglishProfile,
} from './universeEnglish';

function base(over: Partial<UniverseEnglishProfile> = {}): UniverseEnglishProfile {
  return coerceUniverseEnglishProfile({
    onboarded: true,
    level: 'A1',
    goal: 'travel',
    nativeLang: 'fr',
    currentLessonId: 'travel-greet-l01',
    completedLessonIds: [],
    skippedChapterIds: [],
    weakWords: [],
    updatedAt: 1000,
    ...over,
  });
}

describe('mergeUniverseEnglishProfiles', () => {
  it('unions lessons and skips, keeps newer level/goal', () => {
    const local = base({
      level: 'A2',
      goal: 'travel',
      completedLessonIds: ['a', 'b'],
      skippedChapterIds: ['ch1'],
      updatedAt: 2000,
    });
    const remote = base({
      level: 'B1',
      goal: 'work',
      currentLessonId: 'work-greet-l01',
      completedLessonIds: ['b', 'c'],
      skippedChapterIds: ['ch2'],
      updatedAt: 500,
    });
    const merged = mergeUniverseEnglishProfiles(local, remote, 3000);
    expect(merged.level).toBe('B1');
    expect(merged.goal).toBe('work');
    expect(merged.completedLessonIds.sort()).toEqual(['a', 'b', 'c']);
    expect(merged.skippedChapterIds.sort()).toEqual(['ch1', 'ch2']);
  });

  it('keeps per-word weak state with newest updatedAt', () => {
    const local = base({
      weakWords: [{ word: 'bye', misses: 2, streak: 1, updatedAt: 5000 }],
      updatedAt: 5000,
    });
    const remote = base({
      weakWords: [
        { word: 'bye', misses: 1, streak: 0, updatedAt: 1000 },
        { word: 'hello', misses: 1, streak: 1, updatedAt: 2000 },
      ],
      updatedAt: 1000,
    });
    const merged = mergeUniverseEnglishProfiles(local, remote, 1000);
    const bye = merged.weakWords.find((w) => w.word === 'bye');
    const hello = merged.weakWords.find((w) => w.word === 'hello');
    expect(bye?.streak).toBe(1);
    expect(bye?.misses).toBe(2);
    expect(bye?.updatedAt).toBe(5000);
    expect(hello?.streak).toBe(1);
  });

  it('does not resurrect a word cleared on A when B still has it (newer tombstone wins)', () => {
    // Device A validated "bye" (2 successes) → cleared tombstone at t=9000
    const deviceA = base({
      weakWords: [
        { word: 'bye', misses: 3, streak: 2, updatedAt: 9000, cleared: true },
      ],
      updatedAt: 9000,
    });
    // Device B still has "bye" as active (stale)
    const deviceB = base({
      weakWords: [{ word: 'bye', misses: 2, streak: 0, updatedAt: 4000 }],
      updatedAt: 4000,
    });
    const merged = mergeUniverseEnglishProfiles(deviceA, deviceB, 4000);
    const bye = merged.weakWords.find((w) => w.word.toLowerCase() === 'bye');
    expect(bye?.cleared).toBe(true);
    expect(bye?.updatedAt).toBe(9000);
    expect(activeUniverseWeakWords(merged.weakWords).some((w) => w.word === 'bye')).toBe(false);
  });
});
