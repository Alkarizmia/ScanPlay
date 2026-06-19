import type { GamificationState } from '../types';
import { isLoggedIn } from './auth';
import { consumeStreakFreezeCharge, getStreakFreezeCharges, loadWalletRaw, recordStreakLoss } from './wallet';

const KEY = 'scanplay-gamification';

const XP_CORRECT = 10;
const XP_SESSION = 50;

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
  return { claimed: true, newStreak: state.streak, previousStreak };
}

export function getGamification(): GamificationState {
  return load();
}

/** Reset streak if user missed a day (not played today or yesterday). */
export function validateStreak(): { streak: number; justLost: boolean } {
  const state = load();
  if (state.streak === 0 || !state.lastPlayDate) {
    return { streak: state.streak, justLost: false };
  }
  const today = todayKey();
  const yesterday = yesterdayKey();
  if (state.lastPlayDate === today || state.lastPlayDate === yesterday) {
    return { streak: state.streak, justLost: false };
  }
  const wallet = loadWalletRaw();
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
  const nextLastPlay = lastPlayDate;
  if (wallet.lostStreak > 0 && wallet.lostStreakAt && streak > 0) {
    nextStreak = 0;
  } else if (local.streak === 0 && (lossAcked || lossPending) && streak > 0) {
    nextStreak = 0;
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
  }

  save(state);
  return { xpEarned, streakUpdated, newStreak: state.streak };
}

export function addBonusXp(amount: number): void {
  const state = load();
  state.xp += Math.max(0, amount);
  save(state);
}

export function restoreStreakValue(streak: number): void {
  const state = load();
  state.streak = Math.max(1, streak);
  state.lastPlayDate = todayKey();
  save(state);
}

export function addCorrectAnswer(): number {
  const state = load();
  state.xp += XP_CORRECT;
  save(state);
  return XP_CORRECT;
}
