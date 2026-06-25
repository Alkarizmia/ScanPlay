import type { HistoryEntry } from '../types';
import { getNodeProgressFraction, isNodeAllGold } from './pathGamePlan';
import {
  countClearedSteps,
  isPathComplete,
  isStepCleared,
  normalizeStepProgress,
  resolvePathStepCount,
} from './stepProgress';

export function formatHistoryScore(pct: number): string {
  const score = Math.max(0, Math.min(100, Math.round(pct)));
  return `${score}/100`;
}

/** Durée totale d'un parcours en mode examen (secondes → texte lisible). */
export function formatHistoryDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds} s`;

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes < 60) {
    return remainder > 0 ? `${minutes} min ${remainder} s` : `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
}

export function getHistoryPathProgress(entry: HistoryEntry): {
  fraction: number;
  doneSteps: number;
  totalSteps: number;
  complete: boolean;
} {
  const progress = normalizeStepProgress(entry.stepProgress, entry.completedSteps);
  const totalSteps = resolvePathStepCount(entry.pathStepCount);
  const pairs = entry.pairs;

  let units = 0;
  for (let i = 0; i < totalSteps; i += 1) {
    if (isStepCleared(i, progress, false, pairs) || isNodeAllGold(i, progress, pairs)) {
      units += 1;
    } else {
      units += getNodeProgressFraction(i, progress, pairs);
    }
  }

  const fraction = totalSteps > 0 ? Math.min(1, units / totalSteps) : 0;

  return {
    fraction,
    doneSteps: countClearedSteps(progress, false, totalSteps, pairs),
    totalSteps,
    complete: isPathComplete(progress, false, totalSteps, pairs),
  };
}
