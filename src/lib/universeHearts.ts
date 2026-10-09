/** Pix Univers lives: 3 hearts, 1 lost per mistake, each regenerates in 8 hours. */

const KEY = 'scanplay-universe-hearts';
export const UNIVERSE_MAX_HEARTS = 3;
export const UNIVERSE_HEART_REGEN_MS = 8 * 60 * 60 * 1000;

export interface UniverseHeartsState {
  /** Current full hearts (0–3). */
  hearts: number;
  /** Timestamps when each missing heart started regenerating (oldest first). */
  regenStartedAt: number[];
}

function clampHearts(n: number): number {
  return Math.max(0, Math.min(UNIVERSE_MAX_HEARTS, Math.floor(n)));
}

function loadRaw(): UniverseHeartsState {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<UniverseHeartsState> | null;
    if (!parsed || typeof parsed !== 'object') {
      return { hearts: UNIVERSE_MAX_HEARTS, regenStartedAt: [] };
    }
    return {
      hearts: clampHearts(typeof parsed.hearts === 'number' ? parsed.hearts : UNIVERSE_MAX_HEARTS),
      regenStartedAt: Array.isArray(parsed.regenStartedAt)
        ? parsed.regenStartedAt.filter((t): t is number => typeof t === 'number' && t > 0)
        : [],
    };
  } catch {
    return { hearts: UNIVERSE_MAX_HEARTS, regenStartedAt: [] };
  }
}

function save(state: UniverseHeartsState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

/** Apply completed regenerations; returns fresh state. */
export function getUniverseHearts(now = Date.now()): UniverseHeartsState {
  const state = loadRaw();
  let { hearts, regenStartedAt } = state;
  const stillWaiting: number[] = [];

  for (const started of regenStartedAt) {
    if (now - started >= UNIVERSE_HEART_REGEN_MS) {
      hearts = clampHearts(hearts + 1);
    } else {
      stillWaiting.push(started);
    }
  }

  // Keep queue slots aligned with missing hearts
  const missing = UNIVERSE_MAX_HEARTS - hearts;
  while (stillWaiting.length < missing) {
    stillWaiting.push(now);
  }
  const trimmed = stillWaiting.slice(0, missing);

  const next = { hearts, regenStartedAt: trimmed };
  if (next.hearts !== state.hearts || next.regenStartedAt.length !== state.regenStartedAt.length) {
    save(next);
  } else if (trimmed.some((t, i) => t !== state.regenStartedAt[i])) {
    save(next);
  }
  return next;
}

export function canPlayUniverse(now = Date.now()): boolean {
  return getUniverseHearts(now).hearts > 0;
}

/** Lose one heart on a mistake. Returns whether a heart was lost + updated state. */
export function loseUniverseHeart(now = Date.now()): { lost: boolean; state: UniverseHeartsState } {
  const state = getUniverseHearts(now);
  if (state.hearts <= 0) return { lost: false, state };
  const hearts = state.hearts - 1;
  const regenStartedAt = [...state.regenStartedAt, now];
  const next = { hearts, regenStartedAt };
  save(next);
  void import('./sync').then((m) => m.scheduleSync()).catch(() => undefined);
  return { lost: true, state: next };
}

/** Instantly restore one heart (shop refill). Removes the oldest regen timer. */
export function refillUniverseHeart(now = Date.now()): { ok: boolean; state: UniverseHeartsState; reason?: 'full' } {
  const state = getUniverseHearts(now);
  if (state.hearts >= UNIVERSE_MAX_HEARTS) {
    return { ok: false, state, reason: 'full' };
  }
  const regenStartedAt = [...state.regenStartedAt];
  if (regenStartedAt.length > 0) {
    const oldestIdx = regenStartedAt.indexOf(Math.min(...regenStartedAt));
    regenStartedAt.splice(oldestIdx, 1);
  }
  const next = { hearts: clampHearts(state.hearts + 1), regenStartedAt };
  save(next);
  void import('./sync').then((m) => m.scheduleSync()).catch(() => undefined);
  return { ok: true, state: next };
}

/** Ms until the next heart finishes regenerating, or 0 if full. */
export function msUntilNextUniverseHeart(now = Date.now()): number {
  const { hearts, regenStartedAt } = getUniverseHearts(now);
  if (hearts >= UNIVERSE_MAX_HEARTS || regenStartedAt.length === 0) return 0;
  const oldest = Math.min(...regenStartedAt);
  return Math.max(0, oldest + UNIVERSE_HEART_REGEN_MS - now);
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
