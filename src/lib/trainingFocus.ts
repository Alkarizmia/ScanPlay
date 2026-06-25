import type { GameMode, TrainingFocus } from '../types';

const WRITTEN_MODES: GameMode[] = ['flashcards', 'type', 'quiz', 'match', 'truefalse', 'cloze'];
const ORAL_MODES: GameMode[] = ['listen'];

const DEFAULT_FOCUS: TrainingFocus[] = ['written', 'oral'];

let activeFocus: TrainingFocus[] = [...DEFAULT_FOCUS];

export function setTrainingFocus(focus: TrainingFocus[]): void {
  activeFocus =
    focus.includes('written') || focus.includes('oral') ? [...focus] : [...DEFAULT_FOCUS];
}

export function getTrainingFocus(): TrainingFocus[] {
  return activeFocus;
}

export function resetTrainingFocus(): void {
  activeFocus = [...DEFAULT_FOCUS];
}

export function isTrainingFocusApplicable(sheetType: string): boolean {
  return sheetType === 'vocab' || sheetType === 'notes';
}

export function isModeAllowedByFocus(mode: GameMode, focus: TrainingFocus[] = getTrainingFocus()): boolean {
  if (focus.includes('written') && focus.includes('oral')) return true;
  if (focus.includes('written') && !focus.includes('oral')) return !ORAL_MODES.includes(mode);
  if (focus.includes('oral') && !focus.includes('written')) return !WRITTEN_MODES.includes(mode);
  return true;
}

export function filterModesByFocus(modes: GameMode[], focus: TrainingFocus[] = getTrainingFocus()): GameMode[] {
  const filtered = modes.filter((mode) => isModeAllowedByFocus(mode, focus));
  if (filtered.length > 0) return filtered;

  if (focus.includes('oral') && !focus.includes('written')) return ['listen'];
  if (focus.includes('written') && !focus.includes('oral')) return ['flashcards'];
  return modes;
}
