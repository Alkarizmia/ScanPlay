import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth', () => ({
  isLoggedIn: vi.fn(() => false),
}));

vi.mock('./sync', () => ({
  scheduleSync: vi.fn(),
}));

import { isLoggedIn } from './auth';
import { getAiUsageRatio, getTokenUsedEur } from './planUsage';
import { recordGuestScan } from './guestTrial';
import { recordScan } from './planLimits';

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

describe('guest first scan AI envelope', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage());
    vi.stubGlobal('sessionStorage', mockStorage());
    vi.mocked(isLoggedIn).mockReturnValue(false);
  });

  it('stays at 0% when only the free guest slot is burned (no recordScan)', () => {
    recordGuestScan();
    expect(getTokenUsedEur('free')).toBe(0);
    expect(getAiUsageRatio('free')).toBe(0);
  });

  it('would bill the envelope if recordScan ran (logged-in path)', () => {
    vi.mocked(isLoggedIn).mockReturnValue(true);
    recordScan();
    expect(getTokenUsedEur('free')).toBeGreaterThan(0);
    expect(getAiUsageRatio('free')).toBeGreaterThan(0);
  });
});
