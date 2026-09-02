import type { GameMode } from '../types';

/**
 * How much the learner has to produce, from "I recognise it" to "I can produce it
 * unaided". Adaptive selection is not wired yet, but every mode is already placed
 * on the scale so a future engine only has to choose a target level.
 */
export type DifficultyLevel = 1 | 2 | 3 | 4;

export const DIFFICULTY_RECOGNITION: DifficultyLevel = 1;
export const DIFFICULTY_RECALL: DifficultyLevel = 2;
export const DIFFICULTY_PRODUCTION: DifficultyLevel = 3;
export const DIFFICULTY_MIXED: DifficultyLevel = 4;

const MODE_DIFFICULTY: Record<GameMode, DifficultyLevel> = {
  flashcards: DIFFICULTY_RECOGNITION,
  quiz: DIFFICULTY_RECOGNITION,
  truefalse: DIFFICULTY_RECOGNITION,
  listen: DIFFICULTY_RECOGNITION,
  listenpick: DIFFICULTY_RECOGNITION,
  match: DIFFICULTY_RECALL,
  cloze: DIFFICULTY_RECALL,
  reorder: DIFFICULTY_RECALL,
  translate: DIFFICULTY_PRODUCTION,
  type: DIFFICULTY_PRODUCTION,
  dictation: DIFFICULTY_PRODUCTION,
  speak: DIFFICULTY_PRODUCTION,
};

export function getModeDifficulty(mode: GameMode): DifficultyLevel {
  return MODE_DIFFICULTY[mode] ?? DIFFICULTY_RECALL;
}

/** Target level for a node — later nodes ask for more production. */
export function getStepDifficulty(stepIndex: number): DifficultyLevel {
  if (stepIndex <= 1) return DIFFICULTY_RECOGNITION;
  if (stepIndex <= 4) return DIFFICULTY_RECALL;
  if (stepIndex <= 7) return DIFFICULTY_PRODUCTION;
  return DIFFICULTY_MIXED;
}

/**
 * Inside a lesson, warm up before producing: recognition games first, production last.
 * Ties keep their original order so the node's own variety is preserved.
 */
export function sortByDifficulty(modes: GameMode[]): GameMode[] {
  return modes
    .map((mode, index) => ({ mode, index }))
    .sort((a, b) => {
      const delta = getModeDifficulty(a.mode) - getModeDifficulty(b.mode);
      return delta !== 0 ? delta : a.index - b.index;
    })
    .map((entry) => entry.mode);
}
