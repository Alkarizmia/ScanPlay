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
  mergeProfilesPreferRicher,
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

  it('never shows the deprecated pseudo tutorial (name chosen at signup)', () => {
    saveProfileRaw({
      displayName: defaultDisplayName(USER),
      avatar: 'avatar1',
    });
    expect(shouldShowPseudoOnboarding()).toBe(false);

    saveProfileRaw({
      displayName: 'Pix',
      avatar: 'avatar1',
    });
    expect(shouldShowPseudoOnboarding()).toBe(false);

    applyPseudoOnboardingFromCloud(true);
    expect(shouldShowPseudoOnboarding()).toBe(false);
  });

  it('does not clear avatar frame when cloud omits the field', () => {
    saveProfileRaw({
      displayName: 'Bilal',
      avatar: 'custom',
      customAvatarData: 'data:image/png;base64,abc',
      bannerTheme: 'aurora',
      avatarFrame: 'frame_gold',
      bannerFrame: 'bframe_gold',
      profileUpdatedAt: Date.now(),
    });

    mergeProfileFromCloud({
      displayName: 'Bilal',
      avatarId: 'custom',
      avatarUrl: 'data:image/png;base64,abc',
      bannerTheme: 'aurora',
      avatarFrame: undefined,
      bannerFrame: undefined,
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const p = JSON.parse(localStorage.getItem('scanplay-profile') ?? '{}');
    expect(p.avatarFrame).toBe('frame_gold');
    expect(p.bannerFrame).toBe('bframe_gold');
  });

  it('does not replace custom photo with default avatar1 from cloud', () => {
    saveProfileRaw({
      displayName: 'Bilal',
      avatar: 'custom',
      customAvatarData: 'data:image/png;base64,abc',
      bannerTheme: 'aurora',
      profileUpdatedAt: Date.now() - 60_000,
    });

    mergeProfileFromCloud({
      displayName: 'Bilal',
      avatarId: 'avatar1',
      avatarUrl: null,
      updatedAt: new Date().toISOString(),
    });

    const p = JSON.parse(localStorage.getItem('scanplay-profile') ?? '{}');
    expect(p.avatar).toBe('custom');
    expect(p.customAvatarData).toBe('data:image/png;base64,abc');
  });

  it('mergeProfilesPreferRicher keeps custom name, photo, fond and frames over defaults', () => {
    const rich = {
      displayName: 'Bilal',
      avatar: 'custom' as const,
      customAvatarData: 'data:image/png;base64,abc',
      bannerTheme: 'aurora',
      avatarFrame: 'frame_gold',
      bannerFrame: 'bframe_gold',
      profileUpdatedAt: 1,
    };
    const def = {
      displayName: defaultDisplayName(USER),
      avatar: 'avatar1' as const,
      bannerTheme: 'green',
      avatarFrame: null,
      bannerFrame: null,
      profileUpdatedAt: 9_999_999,
    };
    const merged = mergeProfilesPreferRicher(def, rich, USER);
    expect(merged.displayName).toBe('Bilal');
    expect(merged.avatar).toBe('custom');
    expect(merged.customAvatarData).toBe('data:image/png;base64,abc');
    expect(merged.bannerTheme).toBe('aurora');
    expect(merged.avatarFrame).toBe('frame_gold');
    expect(merged.bannerFrame).toBe('bframe_gold');
  });
});
