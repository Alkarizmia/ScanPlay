import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth', () => ({
  isLoggedIn: vi.fn(() => false),
}));

vi.mock('./guestTrial', () => ({
  canGuestScan: vi.fn(() => true),
}));

vi.mock('./planUsage', () => ({
  canSpendAiBudget: vi.fn(() => true),
}));

import { isLoggedIn } from './auth';
import { canGuestScan } from './guestTrial';
import { canSpendAiBudget } from './planUsage';
import {
  clampImagesForImport,
  getMaxImagesPerImport,
  getMaxWords,
  PLAN_LIMITS,
  SCAN_SOFT_MAX_WORDS,
} from './planLimits';

function mockFile(name: string): File {
  return new File(['x'], name, { type: 'image/jpeg' });
}

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

describe('import limits', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage());
    vi.mocked(isLoggedIn).mockReturnValue(false);
    vi.mocked(canGuestScan).mockReturnValue(true);
    vi.mocked(canSpendAiBudget).mockReturnValue(true);
  });

  it('keeps files with an image extension even if MIME is empty', () => {
    const nameless = new File(['x'], 'fiche.jpg', { type: '' });
    const { files, dropped } = clampImagesForImport([nameless]);
    expect(files).toHaveLength(1);
    expect(dropped).toBe(0);
  });

  it('limits guests to 1 photo per import', () => {
    expect(getMaxImagesPerImport()).toBe(1);
    const { files, dropped } = clampImagesForImport([mockFile('a.jpg'), mockFile('b.jpg')]);
    expect(files).toHaveLength(1);
    expect(dropped).toBe(1);
  });

  it('blocks guests when trial is used', () => {
    vi.mocked(canGuestScan).mockReturnValue(false);
    expect(getMaxImagesPerImport()).toBe(0);
    const { files, dropped } = clampImagesForImport([mockFile('a.jpg')]);
    expect(files).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it('allows logged-in users a batch when AI budget remains', () => {
    vi.mocked(isLoggedIn).mockReturnValue(true);
    expect(getMaxImagesPerImport()).toBe(20);
  });

  it('blocks logged-in imports when AI envelope is exhausted', () => {
    vi.mocked(isLoggedIn).mockReturnValue(true);
    vi.mocked(canSpendAiBudget).mockReturnValue(false);
    expect(getMaxImagesPerImport()).toBe(0);
  });

  it('uses one soft OCR word cap for every plan', () => {
    expect(getMaxWords()).toBe(SCAN_SOFT_MAX_WORDS);
    expect(PLAN_LIMITS.free.maxWords).toBe(SCAN_SOFT_MAX_WORDS);
    expect(PLAN_LIMITS.plus.maxWords).toBe(SCAN_SOFT_MAX_WORDS);
    expect(PLAN_LIMITS.pro.maxWords).toBe(SCAN_SOFT_MAX_WORDS);
    expect(PLAN_LIMITS.max.maxWords).toBe(SCAN_SOFT_MAX_WORDS);
  });

  it('removes daily scan / synthesis / coach hard caps', () => {
    expect(PLAN_LIMITS.free.scansPerDay).toBe(Infinity);
    expect(PLAN_LIMITS.plus.scansPerDay).toBe(Infinity);
    expect(PLAN_LIMITS.free.synthesesPerMonth).toBe(Infinity);
    expect(PLAN_LIMITS.free.chatPerDay).toBe(Infinity);
  });

  it('gives 10 / 20 / 30 path buttons by plan', () => {
    expect(PLAN_LIMITS.free.pathSteps).toBe(10);
    expect(PLAN_LIMITS.plus.pathSteps).toBe(20);
    expect(PLAN_LIMITS.pro.pathSteps).toBe(30);
  });

  it('gives 2 / 4 / 7 replayable history decks by plan', () => {
    expect(PLAN_LIMITS.free.historyReplay).toBe(2);
    expect(PLAN_LIMITS.plus.historyReplay).toBe(4);
    expect(PLAN_LIMITS.pro.historyReplay).toBe(7);
  });
});
