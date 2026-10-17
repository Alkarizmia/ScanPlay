import { getGamification, getLevel, XP_PER_CORRECT, XP_PER_NEAR } from './gamification';
import { hapticCorrect, hapticWrong } from './haptics';
import { playGameCorrectSound, playSound, resetCorrectCombo } from './sounds';
import type { AnswerGrade } from './vocabulary';

/**
 * Live counters for the in-game HUD. They mirror what the session will grant —
 * the persistent write still happens once at the end (recordSession / applyXpDelta).
 */
export interface GameHudSnapshot {
  xp: number;
  combo: number;
  bestCombo: number;
  answers: number;
}

const EMPTY: GameHudSnapshot = { xp: 0, combo: 0, bestCombo: 0, answers: 0 };

/** Correct with a hint is worth half a clean correct. */
export const HINT_XP_FACTOR = 0.5;

let snapshot: GameHudSnapshot = EMPTY;
const listeners = new Set<() => void>();
/** Review / practice: sounds only, no XP or combo changes. */
let practiceMode = false;

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
  practiceMode = false;
  if (snapshot === EMPTY) return;
  publish(EMPTY);
}

/** Freeze XP/combo while the learner retries missed words (sounds still play). */
export function setGameHudPracticeMode(on: boolean): void {
  practiceMode = on;
}

export function xpForGrade(grade: AnswerGrade): number {
  if (grade === 'correct') return XP_PER_CORRECT;
  if (grade === 'near') return XP_PER_NEAR;
  return 0;
}

/**
 * Combo multiplier after this correct/near answer (1-based).
 * ×1 → 1x, ×2 → 1.5x, ×3 → 2x, then climbs toward 3x.
 */
export function comboXpMultiplier(combo: number): number {
  if (combo <= 1) return 1;
  if (combo === 2) return 1.5;
  if (combo === 3) return 2;
  if (combo === 4) return 2.25;
  if (combo === 5) return 2.5;
  return 3;
}

export function xpGainForAnswer(
  grade: AnswerGrade,
  comboAfter: number,
  usedHint = false,
): number {
  const base = xpForGrade(grade);
  if (base <= 0) return 0;
  let xp = Math.max(1, Math.round(base * comboXpMultiplier(comboAfter)));
  if (usedHint) xp = Math.max(1, Math.round(xp * HINT_XP_FACTOR));
  return xp;
}

/**
 * XP lost on a wrong answer. Higher account level = harsher hit.
 * L1 ≈ 4, L50 ≈ 14, L100 ≈ 24.
 */
export function xpPenaltyForWrong(level: number): number {
  const lv = Math.max(1, level);
  const t = Math.min(1, (lv - 1) / 99);
  return Math.round(4 + t * 20);
}

export interface RegisterAnswerOptions {
  /** Path lesson: softer chime than the solo game. */
  pathStep?: boolean;
  /** The caller already played its own sound / haptics. */
  silent?: boolean;
  /** Perfect run flourish. */
  perfect?: boolean;
  /** Idle / reveal hint was used: less XP than a clean correct. */
  usedHint?: boolean;
}

/**
 * Single entry point every game calls after grading an answer:
 * updates the HUD counters and fires the shared sound + haptic feedback.
 * Returns the signed XP delta for the feedback banner (0 in practice mode).
 */
export function registerAnswer(grade: AnswerGrade, options: RegisterAnswerOptions = {}): number {
  let delta = 0;

  if (!practiceMode) {
    if (grade === 'wrong') {
      const level = getLevel(getGamification().xp);
      delta = -xpPenaltyForWrong(level);
      publish({
        xp: snapshot.xp + delta,
        combo: 0,
        bestCombo: snapshot.bestCombo,
        answers: snapshot.answers + 1,
      });
    } else {
      const combo = snapshot.combo + 1;
      delta = xpGainForAnswer(grade, combo, options.usedHint === true);
      publish({
        xp: snapshot.xp + delta,
        combo,
        bestCombo: Math.max(snapshot.bestCombo, combo),
        answers: snapshot.answers + 1,
      });
    }
  }

  if (options.silent) return delta;

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

  return delta;
}
