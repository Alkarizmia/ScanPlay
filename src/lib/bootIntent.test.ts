import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearBootLocale,
  consumeBootLocale,
  setBootLocale,
} from './bootIntent';

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

describe('boot locale', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', mockStorage());
    clearBootLocale();
  });

  it('keeps the landing locale across a Strict Mode double consume', () => {
    setBootLocale('fr');
    expect(consumeBootLocale()).toBe('fr');
    expect(consumeBootLocale()).toBe('fr');
    clearBootLocale();
    expect(consumeBootLocale()).toBeNull();
  });

  it('preserves every supported landing language', () => {
    for (const lang of ['fr', 'en', 'nl', 'es', 'ar', 'de'] as const) {
      clearBootLocale();
      setBootLocale(lang);
      expect(consumeBootLocale()).toBe(lang);
    }
  });
});
