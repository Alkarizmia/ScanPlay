/** Pix Univers lives: Free 3 / Plus 5+fast regen / Pro·Max ∞. */

import { getPlan } from './planLimits';
import { PLAN_HEART_TIER } from './planUsage';
import type { Plan } from '../types';

const KEY = 'scanplay-universe-hearts';

/** Default Free cap (kept for callers that expect a finite number). */
export const UNIVERSE_MAX_HEARTS = 3;
export const UNIVERSE_HEART_REGEN_MS = 8 * 60 * 60 * 1000;
export const UNIVERSE_HEART_REGEN_FAST_MS = 4 * 60 * 60 * 1000;

export interface UniverseHeartsState {
  /** Current full hearts (0–cap). Infinite plans always report a high full count. */
  hearts: number;
  /** Timestamps when each missing heart started regenerating (oldest first). */
  regenStartedAt: number[];
}

export function hasInfiniteUniverseHearts(plan: Plan = getPlan()): boolean {
  return PLAN_HEART_TIER[plan] === 'infinite';
}

export function getUniverseHeartCap(plan: Plan = getPlan()): number {
  const tier = PLAN_HEART_TIER[plan];
  if (tier === 'infinite') return Number.POSITIVE_INFINITY;
  if (tier === '5regen') return 5;
  return 3;
}

export function getUniverseRegenMs(plan: Plan = getPlan()): number {
  return PLAN_HEART_TIER[plan] === '5regen' ? UNIVERSE_HEART_REGEN_FAST_MS : UNIVERSE_HEART_REGEN_MS;
}

function clampHearts(n: number, cap: number): number {
  if (!Number.isFinite(cap)) return Math.max(0, Math.floor(n));
  return Math.max(0, Math.min(cap, Math.floor(n)));
}

function loadRaw(cap: number): UniverseHeartsState {
  const fallback = Number.isFinite(cap) ? cap : UNIVERSE_MAX_HEARTS;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<UniverseHeartsState> | null;
    if (!parsed || typeof parsed !== 'object') {
      return { hearts: fallback, regenStartedAt: [] };
    }
    return {
      hearts: clampHearts(typeof parsed.hearts === 'number' ? parsed.hearts : fallback, fallback),
      regenStartedAt: Array.isArray(parsed.regenStartedAt)
        ? parsed.regenStartedAt.filter((t): t is number => typeof t === 'number' && t > 0)
        : [],
    };
  } catch {
    return { hearts: fallback, regenStartedAt: [] };
  }
}

function save(state: UniverseHeartsState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

/** Apply completed regenerations; returns fresh state. */
export function getUniverseHearts(now = Date.now(), plan: Plan = getPlan()): UniverseHeartsState {
  if (hasInfiniteUniverseHearts(plan)) {
    return { hearts: 99, regenStartedAt: [] };
  }

  const cap = getUniverseHeartCap(plan);
  const regenMs = getUniverseRegenMs(plan);
  const state = loadRaw(cap);
  let { hearts, regenStartedAt } = state;
  const stillWaiting: number[] = [];

  for (const started of regenStartedAt) {
    if (now - started >= regenMs) {
      hearts = clampHearts(hearts + 1, cap);
    } else {
      stillWaiting.push(started);
    }
  }

  // Keep timer slots aligned with missing hearts
  const missing = cap - hearts;
  while (stillWaiting.length < missing) {
    stillWaiting.push(now);
  }
  const trimmed = stillWaiting.slice(0, Math.max(0, missing));

  const next = { hearts, regenStartedAt: trimmed };
  if (next.hearts !== state.hearts || next.regenStartedAt.length !== state.regenStartedAt.length) {
    save(next);
  } else if (trimmed.some((t, i) => t !== state.regenStartedAt[i])) {
    save(next);
  }
  return next;
}

export function canPlayUniverse(now = Date.now(), plan: Plan = getPlan()): boolean {
  if (hasInfiniteUniverseHearts(plan)) return true;
  return getUniverseHearts(now, plan).hearts > 0;
}

/** Lose one heart on a mistake. Returns whether a heart was lost + updated state. */
export function loseUniverseHeart(now = Date.now(), plan: Plan = getPlan()): {
  lost: boolean;
  state: UniverseHeartsState;
} {
  if (hasInfiniteUniverseHearts(plan)) {
    return { lost: false, state: { hearts: 99, regenStartedAt: [] } };
  }
  const state = getUniverseHearts(now, plan);
  if (state.hearts <= 0) return { lost: false, state };
  const hearts = state.hearts - 1;
  const regenStartedAt = [...state.regenStartedAt, now];
  const next = { hearts, regenStartedAt };
  save(next);
  void import('./sync').then((m) => m.scheduleSync()).catch(() => undefined);
  return { lost: true, state: next };
}

/** Instantly restore one heart (shop refill). Removes the oldest regen timer. */
export function refillUniverseHeart(now = Date.now(), plan: Plan = getPlan()): {
  ok: boolean;
  state: UniverseHeartsState;
  reason?: 'full';
} {
  if (hasInfiniteUniverseHearts(plan)) {
    return { ok: false, state: { hearts: 99, regenStartedAt: [] }, reason: 'full' };
  }
  const cap = getUniverseHeartCap(plan);
  const state = getUniverseHearts(now, plan);
  if (state.hearts >= cap) {
    return { ok: false, state, reason: 'full' };
  }
  const regenStartedAt = [...state.regenStartedAt];
  if (regenStartedAt.length > 0) {
    const oldestIdx = regenStartedAt.indexOf(Math.min(...regenStartedAt));
    regenStartedAt.splice(oldestIdx, 1);
  }
  const next = { hearts: clampHearts(state.hearts + 1, cap), regenStartedAt };
  save(next);
  void import('./sync').then((m) => m.scheduleSync()).catch(() => undefined);
  return { ok: true, state: next };
}

/** Ms until the next heart finishes regenerating, or 0 if full / infinite. */
export function msUntilNextUniverseHeart(now = Date.now(), plan: Plan = getPlan()): number {
  if (hasInfiniteUniverseHearts(plan)) return 0;
  const cap = getUniverseHeartCap(plan);
  const regenMs = getUniverseRegenMs(plan);
  const { hearts, regenStartedAt } = getUniverseHearts(now, plan);
  if (hearts >= cap || regenStartedAt.length === 0) return 0;
  const oldest = Math.min(...regenStartedAt);
  return Math.max(0, oldest + regenMs - now);
}

export function formatUniverseRegenCountdown(ms: number, locale: string): string {
  if (ms <= 0) return '';
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (locale.startsWith('ar')) {
    if (h <= 0) return `${m} د`;
    return m > 0 ? `${h} س ${m} د` : `${h} س`;
  }
  if (locale.startsWith('en')) {
    if (h <= 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (locale.startsWith('nl')) {
    if (h <= 0) return `${m}m`;
    return m > 0 ? `${h}u ${m}m` : `${h}u`;
  }
  if (locale.startsWith('es')) {
    if (h <= 0) return `${m} min`;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  if (h <= 0) return `${m} min`;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}
