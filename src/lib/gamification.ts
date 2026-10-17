import type { GamificationState } from '../types';
import { isLoggedIn } from './auth';
import { clearStreakRestoreOffer, consumeStreakFreezeCharge, getStreakFreezeCharges, loadWalletRaw, recordStreakLoss } from './wallet';

const KEY = 'scanplay-gamification';

/**
 * Single XP scale for every game. `recordSession` is the only function that
 * writes XP for answers — games display these values live but never credit them,
 * so an answer can never be counted twice.
 */
export const XP_PER_CORRECT = 10;
export const XP_PER_NEAR = 5;
export const XP_SESSION_BONUS = 50;

const XP_CORRECT = XP_PER_CORRECT;
const XP_SESSION = XP_SESSION_BONUS;

function load(): GamificationState {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      xp: data.xp ?? 0,
      streak: data.streak ?? 0,
      lastPlayDate: data.lastPlayDate ?? null,
    };
  } catch {
    return { xp: 0, streak: 0, lastPlayDate: null };
  }
}

function save(state: GamificationState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
  if (isLoggedIn()) {
    void import('./sync').then((m) => m.scheduleSync());
  }
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type StreakClaimResult = {
  claimed: boolean;
  newStreak: number;
  previousStreak: number;
};

/** Call when the user starts a parcours step — counts the day toward their streak. */
export function claimDailyStreak(): StreakClaimResult {
  const state = load();
  const today = todayKey();

  if (state.lastPlayDate === today) {
    return { claimed: false, newStreak: state.streak, previousStreak: state.streak };
  }

  const previousStreak = state.streak;
  if (state.lastPlayDate === yesterdayKey()) {
    state.streak = Math.max(1, state.streak) + 1;
  } else {
    state.streak = 1;
  }
  state.lastPlayDate = today;
  save(state);
  if (walletHasPendingLoss()) {
    clearStreakRestoreOffer();
  }
  return { claimed: true, newStreak: state.streak, previousStreak };
}

function walletHasPendingLoss(): boolean {
  const wallet = loadWalletRaw();
  return wallet.lostStreak > 0 && wallet.lostStreakAt != null;
}

export function getGamification(): GamificationState {
  return load();
}

/** Reset streak if user missed a day (not played today or yesterday). */
export function validateStreak(): { streak: number; justLost: boolean } {
  const state = load();
  const today = todayKey();
  const wallet = loadWalletRaw();

  if (state.lastPlayDate === today && state.streak > 0) {
    return { streak: state.streak, justLost: false };
  }

  if (state.streak === 0 || !state.lastPlayDate) {
    return { streak: state.streak, justLost: false };
  }
  const yesterday = yesterdayKey();
  if (state.lastPlayDate === today || state.lastPlayDate === yesterday) {
    return { streak: state.streak, justLost: false };
  }
  if (wallet.lostStreak > 0 && wallet.lostStreakAt) {
    state.streak = 0;
    save(state);
    return { streak: 0, justLost: false };
  }
  const previousStreak = state.streak;
  if (getStreakFreezeCharges() > 0 && consumeStreakFreezeCharge()) {
    state.lastPlayDate = yesterdayKey();
    save(state);
    return { streak: state.streak, justLost: false };
  }
  state.streak = 0;
  save(state);
  recordStreakLoss(previousStreak);
  return { streak: 0, justLost: true };
}

/** After cloud pull: don't resurrect a streak already lost on another device. */
export function applyGamificationFromCloud(
  xp: number,
  streak: number,
  lastPlayDate: string | null,
): void {
  const local = load();
  const wallet = loadWalletRaw();
  const lossAcked =
    wallet.lostStreak > 0 &&
    wallet.lostStreakAt &&
    wallet.lostStreakAckAt &&
    wallet.lostStreakAckAt >= wallet.lostStreakAt;
  const lossPending =
    wallet.lostStreak > 0 &&
    wallet.lostStreakAt &&
    (!wallet.lostStreakAckAt || wallet.lostStreakAckAt < wallet.lostStreakAt);

  let nextStreak = streak;
  let nextLastPlay = lastPlayDate;
  if (wallet.lostStreak > 0 && wallet.lostStreakAt && streak > 0) {
    nextStreak = 0;
  } else if (local.streak === 0 && (lossAcked || lossPending) && streak > 0) {
    nextStreak = 0;
  }

  const today = todayKey();
  if (local.lastPlayDate === today) {
    nextStreak = Math.max(local.streak, nextStreak);
    nextLastPlay = today;
  }

  save({ xp, streak: nextStreak, lastPlayDate: nextLastPlay });
}

export function getLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

export function xpForNextLevel(xp: number): { current: number; needed: number; progress: number } {
  const level = getLevel(xp);
  const xpAtLevelStart = (level - 1) ** 2 * 50;
  const xpAtNextLevel = level ** 2 * 50;
  const needed = xpAtNextLevel - xpAtLevelStart;
  const current = xp - xpAtLevelStart;
  return { current, needed, progress: Math.min(100, (current / needed) * 100) };
}

export function getTotalScore(): number {
  try {
    const best = JSON.parse(localStorage.getItem('scanplay-best') ?? '{}') as Record<string, number>;
    return Object.values(best).reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

export function recordSession(
  correctCount: number,
  xpMultiplier = 1,
): { xpEarned: number; streakUpdated: boolean; newStreak: number } {
  const state = load();
  const baseXp = correctCount * XP_CORRECT + XP_SESSION;
  const xpEarned = Math.max(1, Math.round(baseXp * xpMultiplier));
  state.xp += xpEarned;

  const today = todayKey();
  let streakUpdated = false;
  if (state.lastPlayDate !== today) {
    if (state.lastPlayDate === yesterdayKey()) {
      state.streak = Math.max(1, state.streak) + 1;
    } else {
      state.streak = 1;
    }
    state.lastPlayDate = today;
    streakUpdated = true;
    if (walletHasPendingLoss()) {
      clearStreakRestoreOffer();
    }
  }

  save(state);
  return { xpEarned, streakUpdated, newStreak: state.streak };
}

export function addBonusXp(amount: number): void {
  const state = load();
  state.xp += Math.max(0, amount);
  save(state);
}

/**
 * English Universe lesson XP from accuracy + account level.
 * Early levels stay encouraging (even a weak run grants a little XP).
 * Higher levels raise the stakes: perfect pays more, a flop can lose XP.
 *
 * Anchors (approx.):
 * - Level 1:  0/10 → +5,  10/10 → +28
 * - Level 100: 0/10 → -50, 10/10 → +100
 */
export function computeEnglishLessonXp(input: {
  correct: number;
  total: number;
  level: number;
}): number {
  const total = Math.max(1, input.total);
  const correct = Math.max(0, Math.min(total, input.correct));
  const ratio = correct / total;
  const level = Math.max(1, input.level);
  /** Progress 0..1 from L1 → L100, then soft-caps. */
  const t = Math.min(1, (level - 1) / 99);

  const minXp = Math.round(5 + t * (-55)); // +5 → -50
  const maxXp = Math.round(28 + t * 72); // +28 → +100

  // Reward perfection a bit more than a linear midpoint.
  const factor = Math.pow(ratio, 1.2);
  let xp = Math.round(minXp + (maxXp - minXp) * factor);

  // Soft floor so new players never feel punished.
  if (level <= 3) xp = Math.max(3, xp);
  else if (level <= 8) xp = Math.max(1, xp);

  return xp;
}

export type ApplyXpDeltaResult = {
  /** Delta actually applied (may be clamped). */
  applied: number;
  xp: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  leveledDown: boolean;
};

/**
 * Apply a signed XP delta. Total XP never goes below 0.
 * Losses are capped to ~35% of the current level span so one flop
 * cannot wipe an entire level.
 */
export function applyXpDelta(delta: number): ApplyXpDeltaResult {
  const state = load();
  const levelBefore = getLevel(state.xp);
  let nextDelta = Math.round(delta);

  if (nextDelta < 0) {
    const { needed } = xpForNextLevel(state.xp);
    const maxLoss = Math.max(8, Math.floor(needed * 0.35));
    nextDelta = Math.max(nextDelta, -maxLoss);
  }

  const nextXp = Math.max(0, state.xp + nextDelta);
  const applied = nextXp - state.xp;
  state.xp = nextXp;
  save(state);
  const levelAfter = getLevel(state.xp);
  return {
    applied,
    xp: state.xp,
    levelBefore,
    levelAfter,
    leveledUp: levelAfter > levelBefore,
    leveledDown: levelAfter < levelBefore,
  };
}

export function restoreStreakValue(streak: number): void {
  const state = load();
  state.streak = Math.max(1, streak);
  state.lastPlayDate = todayKey();
  save(state);
}

/** XP a finished mini-game will grant, for previews before `recordSession` runs. */
export function previewSessionXp(correctCount: number, xpMultiplier = 1): number {
  return Math.max(1, Math.round((correctCount * XP_CORRECT + XP_SESSION) * xpMultiplier));
}
