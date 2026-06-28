import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth', () => ({
  isLoggedIn: vi.fn(() => false),
}));

import { isLoggedIn } from './auth';
import {
  beginGuestPlaySession,
  canGuestScan,
  clearGuestPlaySession,
  isGuestPlaySessionActive,
  recordGuestScan,
} from './guestTrial';

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

describe('guest play session', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage());
    vi.stubGlobal('sessionStorage', mockStorage());
    vi.mocked(isLoggedIn).mockReturnValue(false);
    clearGuestPlaySession();
  });

  it('allows an active guest play session after scan', () => {
    beginGuestPlaySession();
    expect(isGuestPlaySessionActive()).toBe(true);
  });

  it('keeps play session active after the single guest scan is consumed', () => {
    beginGuestPlaySession();
    recordGuestScan();
    expect(canGuestScan()).toBe(false);
    expect(isGuestPlaySessionActive()).toBe(true);
  });
});
