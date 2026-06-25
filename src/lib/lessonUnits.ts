import type { GameMode, WordPair } from '../types';
import { getQuizPool } from './vocabulary';

/** Nombre d'étapes pour la barre de progression unifiée d'une leçon. */
export function getGameUnitCount(mode: GameMode, pairs: WordPair[], examMode = false): number {
  switch (mode) {
    case 'flashcards':
      return Math.min(pairs.length, examMode ? 10 : 8);
    case 'truefalse':
      return Math.min(getQuizPool(pairs).length, 8);
    case 'quiz':
      return Math.min(getQuizPool(pairs).length, examMode ? 12 : 10);
    case 'cloze':
      return Math.min(getQuizPool(pairs).length, 7);
    case 'match':
      return Math.min(6, pairs.length);
    case 'listen':
      return Math.min(getQuizPool(pairs).length, examMode ? 10 : 6);
    case 'type':
    case 'speak':
      return Math.min(pairs.length, examMode ? 10 : 8);
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
