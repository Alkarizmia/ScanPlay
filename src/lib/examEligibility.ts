import type { StepProgressMap } from '../types';
import type { ExamStepGrade } from './examHistory';
import { EXAM_PASS_PCT, isPathComplete, isStepCleared } from './stepProgress';

/** Étapes parcours libre validées avant blocage du mode examen. */
export const EXAM_LOCK_AFTER_NON_EXAM_STEPS = 2;

export interface DeckProgressBundle {
  stepProgress: StepProgressMap;
  examStepProgress: StepProgressMap;
  examModeLocked: boolean;
}

type StoredDeckProgressV2 = {
  v: 2;
  normal: StepProgressMap;
  exam?: StepProgressMap;
  examLocked?: boolean;
};

export function countClearedNonExamSteps(
  progress: StepProgressMap,
  totalSteps: number,
  pairs?: import('../types').WordPair[],
): number {
  let n = 0;
  for (let i = 0; i < totalSteps; i += 1) {
    if (isStepCleared(i, progress, false, pairs)) n += 1;
  }
  return n;
}

export function isExamModeLocked(
  examModeLocked: boolean | undefined,
  stepProgress: StepProgressMap,
  totalSteps: number,
  pairs?: import('../types').WordPair[],
): boolean {
  if (examModeLocked) return true;
  return countClearedNonExamSteps(stepProgress, totalSteps, pairs) >= EXAM_LOCK_AFTER_NON_EXAM_STEPS;
}

export function canEnableExamMode(
  examModeLocked: boolean | undefined,
  stepProgress: StepProgressMap,
  totalSteps: number,
  pairs?: import('../types').WordPair[],
): boolean {
  return !isExamModeLocked(examModeLocked, stepProgress, totalSteps, pairs);
}

export function computeExamFinalGrade(grades: ExamStepGrade[]): number {
  if (grades.length === 0) return 0;
  return Math.round(grades.reduce((s, g) => s + g.pct, 0) / grades.length);
}

export function isExamRunComplete(
  examStepProgress: StepProgressMap,
  examStepGrades: ExamStepGrade[],
  totalSteps: number,
  pairs?: import('../types').WordPair[],
): boolean {
  if (examStepGrades.length < totalSteps) return false;
  const indices = new Set(examStepGrades.map((g) => g.stepIndex));
  if (indices.size < totalSteps) return false;
  if (!isPathComplete(examStepProgress, true, totalSteps, pairs)) return false;
  return examStepGrades.every((g) => g.passed);
}

export function isExamRunPassed(
  examStepProgress: StepProgressMap,
  examStepGrades: ExamStepGrade[],
  totalSteps: number,
  pairs?: import('../types').WordPair[],
): boolean {
  return (
    isExamRunComplete(examStepProgress, examStepGrades, totalSteps, pairs) &&
    computeExamFinalGrade(examStepGrades) >= EXAM_PASS_PCT
  );
}

export function packDeckProgress(bundle: DeckProgressBundle): StepProgressMap | StoredDeckProgressV2 {
  const hasExamData =
    Object.keys(bundle.examStepProgress).length > 0 || bundle.examModeLocked;
  if (!hasExamData) return bundle.stepProgress;
  return {
    v: 2,
    normal: bundle.stepProgress,
    exam: bundle.examStepProgress,
    examLocked: bundle.examModeLocked,
  };
}

export function unpackDeckProgress(raw: unknown): DeckProgressBundle {
  if (!raw || typeof raw !== 'object') {
    return { stepProgress: {}, examStepProgress: {}, examModeLocked: false };
  }
  if ('v' in raw && (raw as StoredDeckProgressV2).v === 2) {
    const stored = raw as StoredDeckProgressV2;
    return {
      stepProgress: stored.normal ?? {},
      examStepProgress: stored.exam ?? {},
      examModeLocked: Boolean(stored.examLocked),
    };
  }
  return {
    stepProgress: raw as StepProgressMap,
    examStepProgress: {},
    examModeLocked: false,
  };
}
