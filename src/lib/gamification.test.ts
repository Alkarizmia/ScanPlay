import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth', () => ({
  isLoggedIn: () => false,
}));

vi.mock('./wallet', () => ({
  clearStreakRestoreOffer: () => {},
  consumeStreakFreezeCharge: () => false,
  getStreakFreezeCharges: () => 0,
  loadWalletRaw: () => ({
    coins: 100,
    gems: 0,
    xpBoostUntil: null,
    lastDailyChest: null,
    lastAdRewardDate: null,
    adWatchesToday: 0,
    lostStreak: 0,
    lostStreakAt: null,
    lostStreakAckAt: null,
    extraScansDate: null,
    extraScansBought: 0,
    synthesisBonusCredits: 0,
    streakFreezeCharges: 0,
    translateHints: 0,
    welcomeHintsGranted: false,
    ownedCosmetics: [],
  }),
  recordStreakLoss: () => {},
}));

import { applyGamificationFromCloud, getGamification, getLevel } from './gamification';

function stubWebStorage() {
  const make = () => {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    };
  };
  vi.stubGlobal('localStorage', make());
  vi.stubGlobal('sessionStorage', make());
}

describe('applyGamificationFromCloud', () => {
  beforeEach(() => {
    stubWebStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the higher of local and cloud XP (never downgrades level progress)', () => {
    localStorage.setItem(
      'scanplay-gamification',
      JSON.stringify({ xp: 400, streak: 2, lastPlayDate: '2026-10-16' }),
    );
    applyGamificationFromCloud(0, 0, null);
    expect(getGamification().xp).toBe(400);
    expect(getLevel(getGamification().xp)).toBe(getLevel(400));
  });

  it('adopts cloud XP when it is ahead of local', () => {
    localStorage.setItem(
      'scanplay-gamification',
      JSON.stringify({ xp: 50, streak: 1, lastPlayDate: '2026-10-15' }),
    );
    applyGamificationFromCloud(500, 3, '2026-10-16');
    expect(getGamification().xp).toBe(500);
    expect(getGamification().streak).toBe(3);
  });
});
