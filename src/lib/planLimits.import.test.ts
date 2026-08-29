import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth', () => ({
  isLoggedIn: vi.fn(() => false),
}));

vi.mock('./guestTrial', () => ({
  canGuestScan: vi.fn(() => true),
}));

import { isLoggedIn } from './auth';
import { canGuestScan } from './guestTrial';
import { clampImagesForImport, getMaxImagesPerImport, PLAN_LIMITS } from './planLimits';

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

  it('allows logged-in free users up to remaining daily scans', () => {
    vi.mocked(isLoggedIn).mockReturnValue(true);
    localStorage.setItem('scanplay-scans-day', JSON.stringify({ [new Date().toISOString().slice(0, 10)]: 1 }));
    expect(getMaxImagesPerImport()).toBe(2);
  });

  it('allows 25 / 100 / 250 words per scan by plan', () => {
    expect(PLAN_LIMITS.free.maxWords).toBe(25);
    expect(PLAN_LIMITS.plus.maxWords).toBe(100);
    expect(PLAN_LIMITS.pro.maxWords).toBe(250);
  });

  it('caps daily scans at 3 / 15 / 30 by plan', () => {
    expect(PLAN_LIMITS.free.scansPerDay).toBe(3);
    expect(PLAN_LIMITS.plus.scansPerDay).toBe(15);
    expect(PLAN_LIMITS.pro.scansPerDay).toBe(30);
  });

  it('gives 10 / 20 / 30 path buttons by plan', () => {
    expect(PLAN_LIMITS.free.pathSteps).toBe(10);
    expect(PLAN_LIMITS.plus.pathSteps).toBe(20);
    expect(PLAN_LIMITS.pro.pathSteps).toBe(30);
  });
});
