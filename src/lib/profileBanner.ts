import type { Plan } from '../types';
import type { TranslationKey } from './i18n';
import { getPlan, isPaidPlan } from './planLimits';
import { getProfile, saveProfileRaw } from './profile';
import { isShopBannerId, ownsCosmetic, type ShopBannerId } from './profileCosmetics';

/** Solid colors: Free. Animated chromatic banners: Plus / Pro / Max. Shop banners: owned. */
export type ProfileBannerId =
  | 'green'
  | 'red'
  | 'blue'
  | 'yellow'
  | 'aurora'
  | 'ocean'
  | 'sunset'
  | 'prism'
  | 'neon'
  | ShopBannerId;

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
  { id: 'aurora', free: false, labelKey: 'bannerAurora' },
  { id: 'ocean', free: false, labelKey: 'bannerOcean' },
  { id: 'sunset', free: false, labelKey: 'bannerSunset' },
  { id: 'prism', free: false, labelKey: 'bannerPrism' },
  { id: 'neon', free: false, labelKey: 'bannerNeon' },
];

const PLAN_BANNER_IDS = new Set(PROFILE_BANNERS.map((b) => b.id));
const BANNER_BY_ID = new Map(PROFILE_BANNERS.map((b) => [b.id, b]));

export function isProfileBannerId(value: unknown): value is ProfileBannerId {
  if (typeof value !== 'string') return false;
  return PLAN_BANNER_IDS.has(value as ProfileBannerId) || isShopBannerId(value);
}

export function canUseBanner(id: ProfileBannerId, plan: Plan = getPlan()): boolean {
  if (!isProfileBannerId(id)) return false;
  if (isShopBannerId(id)) return ownsCosmetic(id);
  const def = BANNER_BY_ID.get(id);
  if (!def) return false;
  return def.free || isPaidPlan(plan);
}

export function getProfileBanner(_plan: Plan = getPlan()): ProfileBannerId {
  const profile = getProfile();
  const stored = profile && 'bannerTheme' in profile ? (profile as { bannerTheme?: unknown }).bannerTheme : null;
  // Faire confiance au fond déjà équipé (ne pas retomber sur green si le wallet / plan charge plus tard).
  if (isProfileBannerId(stored)) return stored;
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
