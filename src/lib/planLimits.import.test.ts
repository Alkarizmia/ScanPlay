import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth', () => ({
  isLoggedIn: vi.fn(() => false),
}));

vi.mock('./guestTrial', () => ({
  canGuestScan: vi.fn(() => true),
}));

import { isLoggedIn } from './auth';
import { canGuestScan } from './guestTrial';
import { clampImagesForImport, getMaxImagesPerImport } from './planLimits';

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
});
