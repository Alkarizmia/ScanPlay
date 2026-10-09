import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAccountLocalData, clearLocalUserData, clearUniverseLocalProgress } from './localData';

function stubWebStorage() {
  const make = () => {
    const store = new Map<string, string>();
    return {
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
    };
  };
  vi.stubGlobal('localStorage', make());
  vi.stubGlobal('sessionStorage', make());
}

describe('localData', () => {
  beforeEach(() => {
    stubWebStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clearLocalUserData removes known user keys', () => {
    localStorage.setItem('scanplay-history', '[]');
    localStorage.setItem('scanplay-theme', 'dark');
    localStorage.setItem('scanplay-universe-english', '{}');
    clearLocalUserData();
    expect(localStorage.getItem('scanplay-history')).toBeNull();
    expect(localStorage.getItem('scanplay-theme')).toBe('dark');
    // Guest Univers progress survives generic user-data wipe (cleared only on sign-out).
    expect(localStorage.getItem('scanplay-universe-english')).toBe('{}');
  });

  it('clearUniverseLocalProgress removes Univers progress keys', () => {
    localStorage.setItem('scanplay-universe-english', '{}');
    localStorage.setItem('scanplay-universe-driving', '{}');
    clearUniverseLocalProgress();
    expect(localStorage.getItem('scanplay-universe-english')).toBeNull();
    expect(localStorage.getItem('scanplay-universe-driving')).toBeNull();
  });

  it('clearAccountLocalData removes scanplay keys except device prefs', () => {
    localStorage.setItem('scanplay-history', '[]');
    localStorage.setItem('scanplay-last-home-deck:abc', '{}');
    localStorage.setItem('scanplay-theme', 'light');
    localStorage.setItem('scanplay-preferences', '{}');
    localStorage.setItem('scanplay-ads-consent', 'granted');
    localStorage.setItem('unrelated-app', 'keep');
    sessionStorage.setItem('scanplay-pending-guest-deck', '{}');
    clearAccountLocalData();
    expect(localStorage.getItem('scanplay-history')).toBeNull();
    expect(localStorage.getItem('scanplay-last-home-deck:abc')).toBeNull();
    expect(localStorage.getItem('scanplay-theme')).toBe('light');
    expect(localStorage.getItem('scanplay-preferences')).toBe('{}');
    expect(localStorage.getItem('scanplay-ads-consent')).toBe('granted');
    expect(localStorage.getItem('unrelated-app')).toBe('keep');
    expect(sessionStorage.getItem('scanplay-pending-guest-deck')).toBeNull();
  });
});
