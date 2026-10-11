import type { Plan } from '../types';
import type { TranslationKey } from './i18n';
import { getPlan } from './planLimits';
import { getProfile, saveProfileRaw } from './profile';

/** All chromatic banners are available to every plan. */
export type ProfileBannerId =
  | 'green'
  | 'red'
  | 'blue'
  | 'yellow'
  | 'aurora'
  | 'ocean'
  | 'sunset'
  | 'prism'
  | 'neon';

export interface ProfileBannerDef {
  id: ProfileBannerId;
  free: boolean;
  labelKey: TranslationKey;
}

export const PROFILE_BANNERS: ProfileBannerDef[] = [
  { id: 'green', free: true, labelKey: 'bannerGreen' },
  { id: 'red', free: true, labelKey: 'bannerRed' },
  { id: 'blue', free: true, labelKey: 'bannerBlue' },
  { id: 'yellow', free: true, labelKey: 'bannerYellow' },
  { id: 'aurora', free: true, labelKey: 'bannerAurora' },
  { id: 'ocean', free: true, labelKey: 'bannerOcean' },
  { id: 'sunset', free: true, labelKey: 'bannerSunset' },
  { id: 'prism', free: true, labelKey: 'bannerPrism' },
  { id: 'neon', free: true, labelKey: 'bannerNeon' },
];

const BANNER_IDS = new Set(PROFILE_BANNERS.map((b) => b.id));

export function isProfileBannerId(value: unknown): value is ProfileBannerId {
  return typeof value === 'string' && BANNER_IDS.has(value as ProfileBannerId);
}

export function canUseBanner(id: ProfileBannerId, _plan: Plan = getPlan()): boolean {
  return isProfileBannerId(id);
}

export function getProfileBanner(plan: Plan = getPlan()): ProfileBannerId {
  const profile = getProfile();
  const stored = profile && 'bannerTheme' in profile ? (profile as { bannerTheme?: unknown }).bannerTheme : null;
  if (isProfileBannerId(stored) && canUseBanner(stored, plan)) return stored;
  return 'green';
}

export function setProfileBanner(id: ProfileBannerId): boolean {
  const profile = getProfile();
  if (!profile) return false;
  if (!canUseBanner(id)) return false;
  saveProfileRaw({
    ...profile,
    bannerTheme: id,
    profileUpdatedAt: Date.now(),
  });
  void import('./sync').then((m) => void m.pushUserData());
  void import('./social/publicProfile').then((m) => void m.syncPublicProfile());
  return true;
}

export function hasVerifiedBadge(plan: Plan = getPlan()): boolean {
  return plan === 'max';
}

/** Resolve another player's banner for display (no plan lock — show what they saved). */
export function bannerClassFromTheme(theme?: string | null): ProfileBannerId {
  return isProfileBannerId(theme) ? theme : 'green';
}
