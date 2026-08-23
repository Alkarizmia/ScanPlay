import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth', () => ({
  isLoggedIn: vi.fn(() => false),
}));

import { isLoggedIn } from './auth';
import {
  adoptPendingGuestDeckIntoHistory,
  clearPendingGuestDeck,
  hasPendingGuestDeck,
  loadPendingGuestDeck,
  savePendingGuestDeck,
  takeLastAdoptedGuestDeck,
} from './pendingGuestDeck';
import { loadHistoryRaw } from './history';

function mockStorage() {
  const store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return store[key] ?? null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
  };
}

const pairs = [
  { term: 'chat', definition: 'cat' },
  { term: 'chien', definition: 'dog' },
];

describe('pending guest deck', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage());
    vi.stubGlobal('sessionStorage', mockStorage());
    vi.mocked(isLoggedIn).mockReturnValue(false);
    clearPendingGuestDeck();
    takeLastAdoptedGuestDeck();
  });

  it('saves and loads the generated pairs from sessionStorage', () => {
    savePendingGuestDeck(pairs, 'thumb', 'vocab');
    const loaded = loadPendingGuestDeck();
    expect(loaded?.pairs).toEqual(pairs);
    expect(loaded?.thumbnail).toBe('thumb');
    expect(loaded?.sheetType).toBe('vocab');
    expect(hasPendingGuestDeck()).toBe(true);
  });

  it('falls back to localStorage when sessionStorage is empty', () => {
    savePendingGuestDeck(pairs, undefined, 'notes');
    sessionStorage.removeItem('scanplay-pending-guest-deck');
    const loaded = loadPendingGuestDeck();
    expect(loaded?.pairs).toEqual(pairs);
    expect(loaded?.sheetType).toBe('notes');
  });

  it('does not save when the user is already logged in', () => {
    vi.mocked(isLoggedIn).mockReturnValue(true);
    savePendingGuestDeck(pairs);
    expect(hasPendingGuestDeck()).toBe(false);
  });

  it('does not adopt before authentication', () => {
    savePendingGuestDeck(pairs);
    expect(adoptPendingGuestDeckIntoHistory()).toBeNull();
    expect(hasPendingGuestDeck()).toBe(true);
    expect(loadHistoryRaw()).toHaveLength(0);
  });

  it('adopts into history after login and can be taken once', () => {
    savePendingGuestDeck(pairs, undefined, 'definitions');
    vi.mocked(isLoggedIn).mockReturnValue(true);
    const entry = adoptPendingGuestDeckIntoHistory();
    expect(entry?.pairs).toEqual(pairs);
    expect(entry?.sheetType).toBe('definitions');
    expect(hasPendingGuestDeck()).toBe(false);
    expect(loadHistoryRaw()[0]?.id).toBe(entry?.id);
    expect(takeLastAdoptedGuestDeck()?.id).toBe(entry?.id);
    expect(takeLastAdoptedGuestDeck()).toBeNull();
    expect(adoptPendingGuestDeckIntoHistory()).toBeNull();
  });
});
