import { XP_PER_CORRECT, XP_PER_NEAR } from './gamification';
import { hapticCorrect, hapticWrong } from './haptics';
import { playGameCorrectSound, playSound, resetCorrectCombo } from './sounds';
import type { AnswerGrade } from './vocabulary';

/**
 * Live counters for the in-game HUD. They mirror what the session will grant —
 * the persistent write still happens once, in `recordSession` at the end of a mini-game.
 */
export interface GameHudSnapshot {
  xp: number;
  combo: number;
  bestCombo: number;
  answers: number;
}

const EMPTY: GameHudSnapshot = { xp: 0, combo: 0, bestCombo: 0, answers: 0 };

let snapshot: GameHudSnapshot = EMPTY;
const listeners = new Set<() => void>();

function publish(next: GameHudSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function subscribeGameHud(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getGameHudSnapshot(): GameHudSnapshot {
  return snapshot;
}

/** Call when a lesson (or a solo game) starts, not between mini-games. */
export function resetGameHud(): void {
  resetCorrectCombo();
  if (snapshot === EMPTY) return;
  publish(EMPTY);
}

export function xpForGrade(grade: AnswerGrade): number {
  if (grade === 'correct') return XP_PER_CORRECT;
  if (grade === 'near') return XP_PER_NEAR;
  return 0;
}

export interface RegisterAnswerOptions {
  /** Path lesson: softer chime than the solo game. */
  pathStep?: boolean;
  /** The caller already played its own sound / haptics. */
  silent?: boolean;
  /** Perfect run flourish. */
  perfect?: boolean;
}

/**
 * Single entry point every game calls after grading an answer:
 * updates the HUD counters and fires the shared sound + haptic feedback.
 * Returns the XP the answer is worth, for the feedback banner.
 */
export function registerAnswer(grade: AnswerGrade, options: RegisterAnswerOptions = {}): number {
  const xp = xpForGrade(grade);
  const combo = grade === 'wrong' ? 0 : snapshot.combo + 1;

  publish({
    xp: snapshot.xp + xp,
    combo,
    bestCombo: Math.max(snapshot.bestCombo, combo),
    answers: snapshot.answers + 1,
  });

  if (options.silent) return xp;

  if (grade === 'correct') {
    hapticCorrect();
    playGameCorrectSound(options.pathStep === true, options.perfect === true);
  } else if (grade === 'near') {
    hapticCorrect();
    playSound('nearMiss');
  } else {
    hapticWrong();
    playSound('wrong');
  }

  return xp;
}
