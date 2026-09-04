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
  it('allows 2 replay slots on free', () => {
    expect(getHistoryReplaySlots('free')).toBe(2);
  });

  it('allows 4 replay slots on plus', () => {
    expect(getHistoryReplaySlots('plus')).toBe(4);
  });

  it('allows 7 replay slots on pro', () => {
    expect(getHistoryReplaySlots('pro')).toBe(7);
  });

  it('two newest entries are replayable on free', () => {
    seedHistory(['old', 'mid', 'new']);
    expect(canReplayHistoryEntry('new', 'free')).toBe(true);
    expect(canReplayHistoryEntry('mid', 'free')).toBe(true);
    expect(canReplayHistoryEntry('old', 'free')).toBe(false);
  });

  it('four newest entries replayable on plus', () => {
    seedHistory(['a', 'b', 'c', 'd', 'e']);
    expect(canReplayHistoryEntry('e', 'plus')).toBe(true);
    expect(canReplayHistoryEntry('d', 'plus')).toBe(true);
    expect(canReplayHistoryEntry('c', 'plus')).toBe(true);
    expect(canReplayHistoryEntry('b', 'plus')).toBe(true);
    expect(canReplayHistoryEntry('a', 'plus')).toBe(false);
  });

  it('seven newest entries replayable on pro', () => {
    seedHistory(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(canReplayHistoryEntry('8', 'pro')).toBe(true);
    expect(canReplayHistoryEntry('2', 'pro')).toBe(true);
    expect(canReplayHistoryEntry('1', 'pro')).toBe(false);
  });
});
