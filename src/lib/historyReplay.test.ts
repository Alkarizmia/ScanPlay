import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('./auth', () => ({
  isLoggedIn: () => true,
}));

import { canReplayHistoryEntry, getHistoryReplaySlots } from './historyReplay';

const STORAGE_KEY = 'scanplay-history';

const store: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  });
});

function seedHistory(ids: string[]) {
  const entries = ids.map((id, i) => ({
    id,
    title: `Deck ${i}`,
    pairs: [{ term: 'a', definition: 'b' }],
    createdAt: new Date(Date.now() - (ids.length - 1 - i) * 1000).toISOString(),
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

describe('historyReplay', () => {
  it('allows 1 replay slot on free/plus', () => {
    expect(getHistoryReplaySlots('free')).toBe(1);
    expect(getHistoryReplaySlots('plus')).toBe(1);
  });

  it('allows 2 replay slots on pro', () => {
    expect(getHistoryReplaySlots('pro')).toBe(2);
  });

  it('only newest entry is replayable on free', () => {
    seedHistory(['old', 'new']);
    expect(canReplayHistoryEntry('new', 'free')).toBe(true);
    expect(canReplayHistoryEntry('old', 'free')).toBe(false);
  });

  it('two newest entries replayable on pro', () => {
    seedHistory(['oldest', 'middle', 'newest']);
    expect(canReplayHistoryEntry('newest', 'pro')).toBe(true);
    expect(canReplayHistoryEntry('middle', 'pro')).toBe(true);
    expect(canReplayHistoryEntry('oldest', 'pro')).toBe(false);
  });
});
