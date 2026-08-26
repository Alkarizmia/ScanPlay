import type { LessonGameResult } from '../types';

const KEY = 'scanplay-lesson-checkpoint';

export interface LessonCheckpoint {
  deckId: string;
  stepIndex: number;
  /** First mini-game that is not finished — resume here, not mid-question. */
  nextGameIndex: number;
  /** Time spent on the current unfinished mini-game (ms). */
  pendingMs: number;
  games: LessonGameResult[];
  startedAt: number;
  /** Extra rotation so resumed items are not the exact same slice. */
  pairShift: number;
}

export function loadLessonCheckpoint(): LessonCheckpoint | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as LessonCheckpoint;
    if (typeof data.deckId !== 'string' || typeof data.stepIndex !== 'number') return null;
    if (typeof data.nextGameIndex !== 'number' || data.nextGameIndex < 0) return null;
    if (!Array.isArray(data.games)) return null;
    return {
      deckId: data.deckId,
      stepIndex: data.stepIndex,
      nextGameIndex: data.nextGameIndex,
      pendingMs: Math.max(0, Number(data.pendingMs) || 0),
      games: data.games,
      startedAt: Number(data.startedAt) || Date.now(),
      pairShift: Math.max(0, Number(data.pairShift) || 0),
    };
  } catch {
    return null;
  }
}

export function saveLessonCheckpoint(checkpoint: LessonCheckpoint): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(checkpoint));
  } catch {
    /* quota */
  }
}

export function clearLessonCheckpoint(deckId?: string, stepIndex?: number): void {
  const current = loadLessonCheckpoint();
  if (deckId != null && current && (current.deckId !== deckId || current.stepIndex !== stepIndex)) {
    return;
  }
  localStorage.removeItem(KEY);
}

export function checkpointMatches(
  checkpoint: LessonCheckpoint | null,
  deckId: string,
  stepIndex: number,
): boolean {
  return Boolean(checkpoint && checkpoint.deckId === deckId && checkpoint.stepIndex === stepIndex);
}

export function addPendingTime(checkpoint: LessonCheckpoint, extraMs: number): LessonCheckpoint {
  return { ...checkpoint, pendingMs: checkpoint.pendingMs + Math.max(0, extraMs) };
}
