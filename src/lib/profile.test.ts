import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

vi.mock('./auth', () => ({
  isLoggedIn: () => true,
  getUserId: () => USER,
}));

import { defaultDisplayName, isDefaultDisplayName, mergeProfileFromCloud, saveProfileRaw } from './profile';

describe('display name merge', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  it('detects default ID names', () => {
    expect(isDefaultDisplayName('ID-1234', USER)).toBe(true);
    expect(isDefaultDisplayName(defaultDisplayName(USER), USER)).toBe(true);
    expect(isDefaultDisplayName('Bilal', USER)).toBe(false);
  });

  it('never replaces custom local name with default cloud ID', () => {
    saveProfileRaw({
      displayName: 'Bilal',
      avatar: 'avatar1',
      profileUpdatedAt: Date.now() - 60_000,
    });

    mergeProfileFromCloud({
      displayName: defaultDisplayName(USER),
      avatarId: 'avatar1',
      updatedAt: new Date().toISOString(),
    });

    expect(JSON.parse(localStorage.getItem('scanplay-profile') ?? '{}').displayName).toBe('Bilal');
  });
});
