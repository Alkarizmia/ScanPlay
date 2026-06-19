import { describe, expect, it } from 'vitest';
import type { ExamStepGrade } from './examHistory';
import {
  EXAM_LOCK_AFTER_NON_EXAM_STEPS,
  canEnableExamMode,
  computeExamFinalGrade,
  countClearedNonExamSteps,
  isExamRunComplete,
  isExamRunPassed,
  packDeckProgress,
  unpackDeckProgress,
} from './examEligibility';

describe('examEligibility', () => {
  it('locks exam after enough normal steps', () => {
    const progress = {
      0: { pct: 100, tier: 'gold' as const },
      1: { pct: 100, tier: 'gold' as const },
    };
    expect(countClearedNonExamSteps(progress, 10)).toBe(2);
    expect(canEnableExamMode(false, progress, 10)).toBe(false);
    expect(EXAM_LOCK_AFTER_NON_EXAM_STEPS).toBe(2);
  });

  it('allows exam with one normal step cleared', () => {
    const progress = { 0: { pct: 100, tier: 'gold' as const } };
    expect(canEnableExamMode(false, progress, 10)).toBe(true);
  });

  it('requires every exam step grade before completion', () => {
    const examProgress = {
      0: { pct: 80, tier: 'iron' as const },
      1: { pct: 75, tier: 'iron' as const },
    };
    const grades: ExamStepGrade[] = [
      { stepIndex: 0, mode: 'quiz', pct: 80, passed: true },
      { stepIndex: 1, mode: 'type', pct: 75, passed: true },
    ];
    expect(isExamRunComplete(examProgress, grades, 2)).toBe(true);
    expect(isExamRunPassed(examProgress, grades, 2)).toBe(true);
    expect(computeExamFinalGrade(grades)).toBe(78);
  });

  it('rejects exam completion when a step failed in exam mode', () => {
    const examProgress = {
      0: { pct: 80, tier: 'iron' as const },
      1: { pct: 50, tier: 'bronze' as const },
    };
    const grades: ExamStepGrade[] = [
      { stepIndex: 0, mode: 'quiz', pct: 80, passed: true },
      { stepIndex: 1, mode: 'type', pct: 50, passed: false },
    ];
    expect(isExamRunComplete(examProgress, grades, 2)).toBe(false);
    expect(isExamRunPassed(examProgress, grades, 2)).toBe(false);
  });

  it('packs and unpacks deck progress for sync', () => {
    const packed = packDeckProgress({
      stepProgress: { 0: { pct: 100, tier: 'gold' } },
      examStepProgress: { 0: { pct: 72, tier: 'iron' } },
      examModeLocked: true,
    });
    expect(packed).toMatchObject({ v: 2 });
    const restored = unpackDeckProgress(packed);
    expect(restored.examModeLocked).toBe(true);
    expect(restored.examStepProgress[0]?.pct).toBe(72);
  });
});
