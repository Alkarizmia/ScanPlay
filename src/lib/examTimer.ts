import type { GameMode } from '../types';

/** Seconds per unit for exam chronometer (70% required to pass). */
const SEC_PER_QUIZ_QUESTION = 18;
const SEC_PER_FLASHCARD = 10;
const SEC_PER_MATCH_PAIR = 14;

export function getExamTimerSeconds(mode: GameMode, unitCount: number): number {
  const n = Math.max(1, unitCount);
  if (mode === 'quiz') return Math.min(180, Math.max(45, n * SEC_PER_QUIZ_QUESTION));
  if (mode === 'match') return Math.min(200, Math.max(50, n * SEC_PER_MATCH_PAIR));
  if (mode === 'type') return Math.min(180, Math.max(50, n * 16));
  if (mode === 'speak') return Math.min(160, Math.max(45, n * 14));
  return Math.min(160, Math.max(40, n * SEC_PER_FLASHCARD));
}

export function getExamPathBudgetSeconds(stepCount?: number): number {
  const steps = stepCount ?? 10;
  return steps * 75;
}
