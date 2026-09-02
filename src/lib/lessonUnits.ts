import type { GameMode, WordPair } from '../types';
import { getQuizPool } from './vocabulary';

/** Path lesson: a few items then switch game — not 8–10 of the same type. */
export const LESSON_SHORT_ROUNDS = 2;
export const LESSON_MATCH_PAIRS = 3;

export function capLessonItems(raw: number, examMode: boolean, maxItems?: number, match = false): number {
  if (examMode) return Math.max(1, raw);
  const cap = maxItems ?? (match ? LESSON_MATCH_PAIRS : LESSON_SHORT_ROUNDS);
  return Math.max(1, Math.min(raw, cap));
}

/** Nombre d'étapes pour la barre de progression unifiée d'une leçon. */
export function getGameUnitCount(mode: GameMode, pairs: WordPair[], examMode = false): number {
  switch (mode) {
    case 'flashcards':
      return capLessonItems(Math.min(pairs.length, examMode ? 10 : 8), examMode);
    case 'truefalse':
      return capLessonItems(Math.min(getQuizPool(pairs).length, 8), examMode);
    case 'quiz':
      return capLessonItems(Math.min(getQuizPool(pairs).length, examMode ? 12 : 10), examMode);
    case 'cloze':
      return capLessonItems(Math.min(getQuizPool(pairs).length, 7), examMode);
    case 'translate':
      return capLessonItems(Math.min(pairs.length, examMode ? 8 : 6), examMode);
    case 'match':
      return capLessonItems(Math.min(6, pairs.length), examMode, undefined, true);
    case 'listen':
      return capLessonItems(Math.min(getQuizPool(pairs).length, examMode ? 10 : 6), examMode);
    case 'listenpick':
      return capLessonItems(Math.min(getQuizPool(pairs).length, 6), examMode);
    case 'dictation':
      return capLessonItems(Math.min(pairs.length, 6), examMode);
    case 'reorder':
      return capLessonItems(Math.min(pairs.length, 5), examMode);
    case 'type':
    case 'speak':
      return capLessonItems(Math.min(pairs.length, examMode ? 10 : 8), examMode);
    default:
      return 1;
  }
}

export function getLessonTotalUnits(modes: GameMode[], pairs: WordPair[], examMode = false): number {
  return modes.reduce((sum, m) => sum + getGameUnitCount(m, pairs, examMode), 0);
}

export function getLessonUnitOffsets(modes: GameMode[], pairs: WordPair[], examMode = false): number[] {
  let acc = 0;
  return modes.map((m) => {
    const offset = acc;
    acc += getGameUnitCount(m, pairs, examMode);
    return offset;
  });
}
