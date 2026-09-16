import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimPathTestChest,
  healPathTestChestIfPastGate,
  isPathTestChestOpened,
  migratePathChestToDeck,
  PATH_TEST_CHEST_AFTER_STEP,
} from './pathChest';

function stubWebStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
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
  });
}

describe('path chests', () => {
  beforeEach(() => {
    stubWebStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not pay a second reward for the same deck', () => {
    const first = claimPathTestChest('deck-a');
    const second = claimPathTestChest('deck-a');
    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: 'already_claimed' });
    expect(isPathTestChestOpened('deck-a')).toBe(true);
  });

  it('migrates a chest opened before the history id existed', () => {
    expect(claimPathTestChest(null).ok).toBe(true);
    expect(isPathTestChestOpened(null)).toBe(true);
    migratePathChestToDeck('deck-b');
    expect(isPathTestChestOpened('deck-b')).toBe(true);
    expect(claimPathTestChest('deck-b')).toEqual({ ok: false, reason: 'already_claimed' });
  });

  it('heals a chest if the learner is already past the gate', () => {
    expect(isPathTestChestOpened('deck-c')).toBe(false);
    expect(healPathTestChestIfPastGate('deck-c', PATH_TEST_CHEST_AFTER_STEP + 1)).toBe(false);
    expect(healPathTestChestIfPastGate('deck-c', PATH_TEST_CHEST_AFTER_STEP + 2)).toBe(true);
    expect(isPathTestChestOpened('deck-c')).toBe(true);
    expect(claimPathTestChest('deck-c')).toEqual({ ok: false, reason: 'already_claimed' });
  });
});
