import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

vi.mock('./auth', () => ({
  isLoggedIn: () => true,
  getUserId: () => USER,
}));

import {
  applyPseudoOnboardingFromCloud,
  defaultDisplayName,
  isDefaultDisplayName,
  mergeProfileFromCloud,
  saveProfileRaw,
  shouldShowPseudoOnboarding,
} from './profile';

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

  it('shows the pseudo tutorial once until OK or skip is stored', () => {
    saveProfileRaw({
      displayName: defaultDisplayName(USER),
      avatar: 'avatar1',
    });
    expect(shouldShowPseudoOnboarding()).toBe(true);

    saveProfileRaw({
      displayName: 'PixFan',
      avatar: 'avatar1',
    });
    expect(shouldShowPseudoOnboarding()).toBe(true);

    saveProfileRaw({
      displayName: defaultDisplayName(USER),
      avatar: 'avatar1',
      pseudoOnboardingDone: true,
    });
    expect(shouldShowPseudoOnboarding()).toBe(false);
  });

  it('keeps the tutorial closed after the cloud flag is true', () => {
    saveProfileRaw({
      displayName: defaultDisplayName(USER),
      avatar: 'avatar1',
    });
    applyPseudoOnboardingFromCloud(true);
    expect(shouldShowPseudoOnboarding()).toBe(false);
  });
});
