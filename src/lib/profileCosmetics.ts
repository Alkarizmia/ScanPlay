import type { TranslationKey } from './i18n';
import { getProfile, saveProfileRaw } from './profile';
import { loadWalletRaw, saveWalletRaw } from './wallet';

/** banner = fond ; bannerFrame = cadre autour du fond ; avatar = cercle autour de la photo. */
export type CosmeticType = 'banner' | 'bannerFrame' | 'avatar';
export type CosmeticRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type CosmeticTheme = 'neutral' | 'space' | 'ocean' | 'fire' | 'forest' | 'aurora';

/** Shop-only banners (not the 9 plan-gated PROFILE_BANNERS). */
export type ShopBannerId =
  | 'slate'
  | 'blush'
  | 'nightforest'
  | 'stars'
  | 'waves'
  | 'northern'
  | 'lava'
  | 'galaxy'
  | 'blackhole'
  | 'nebula'
  | 'void'
  | 'comet'
  | 'ember'
  | 'reef';

/** Cadre autour du bloc fond (hero). */
export type BannerFrameId =
  | 'bframe_simple'
  | 'bframe_gold'
  | 'bframe_space'
  | 'bframe_orbit'
  | 'bframe_lava'
  | 'bframe_reef'
  | 'bframe_aurora';

/** Cercle autour de la photo de profil. */
export type AvatarRingId =
  | 'frame_white'
  | 'frame_gold'
  | 'frame_neon'
  | 'frame_rainbow'
  | 'frame_flames'
  | 'frame_sparks'
  | 'frame_space'
  | 'frame_orbit'
  | 'frame_lava'
  | 'frame_reef';

/** @deprecated alias kept for older imports */
export type ProfileFrameId = AvatarRingId;

export type ProfileCosmeticId = ShopBannerId | BannerFrameId | AvatarRingId;

export interface ProfileCosmeticDef {
  id: ProfileCosmeticId;
  type: CosmeticType;
  nameKey: TranslationKey;
  rarity: CosmeticRarity;
  price: number;
  animated: boolean;
  /** Famille visuelle pour assembler fond + cadres assortis. */
  theme: CosmeticTheme;
}

/**
 * Easy to edit. CSS:
 * - banner → `.sp-profile-hero--{id}`
 * - bannerFrame → `.sp-profile-hero-frame--{id}` on the hero
 * - avatar → `.sp-profile-frame--{id}` on the avatar button
 */
export const PROFILE_COSMETICS: readonly ProfileCosmeticDef[] = [
  // —— Fonds ——
  { id: 'slate', type: 'banner', nameKey: 'cosmeticBannerSlate', rarity: 'common', price: 120, animated: false, theme: 'neutral' },
  { id: 'blush', type: 'banner', nameKey: 'cosmeticBannerBlush', rarity: 'common', price: 120, animated: false, theme: 'neutral' },
  { id: 'nightforest', type: 'banner', nameKey: 'cosmeticBannerNightforest', rarity: 'common', price: 150, animated: false, theme: 'forest' },
  { id: 'reef', type: 'banner', nameKey: 'cosmeticBannerReef', rarity: 'common', price: 150, animated: false, theme: 'ocean' },
  { id: 'stars', type: 'banner', nameKey: 'cosmeticBannerStars', rarity: 'rare', price: 400, animated: true, theme: 'space' },
  { id: 'waves', type: 'banner', nameKey: 'cosmeticBannerWaves', rarity: 'rare', price: 450, animated: true, theme: 'ocean' },
  { id: 'comet', type: 'banner', nameKey: 'cosmeticBannerComet', rarity: 'rare', price: 480, animated: true, theme: 'space' },
  { id: 'ember', type: 'banner', nameKey: 'cosmeticBannerEmber', rarity: 'rare', price: 450, animated: true, theme: 'fire' },
  { id: 'northern', type: 'banner', nameKey: 'cosmeticBannerNorthern', rarity: 'epic', price: 900, animated: true, theme: 'aurora' },
  { id: 'lava', type: 'banner', nameKey: 'cosmeticBannerLava', rarity: 'epic', price: 1200, animated: true, theme: 'fire' },
  { id: 'nebula', type: 'banner', nameKey: 'cosmeticBannerNebula', rarity: 'epic', price: 1100, animated: true, theme: 'space' },
  { id: 'galaxy', type: 'banner', nameKey: 'cosmeticBannerGalaxy', rarity: 'legendary', price: 1800, animated: true, theme: 'space' },
  { id: 'blackhole', type: 'banner', nameKey: 'cosmeticBannerBlackhole', rarity: 'legendary', price: 2000, animated: true, theme: 'space' },
  { id: 'void', type: 'banner', nameKey: 'cosmeticBannerVoid', rarity: 'legendary', price: 1900, animated: true, theme: 'space' },

  // —— Cadres autour du fond ——
  { id: 'bframe_simple', type: 'bannerFrame', nameKey: 'cosmeticBframeSimple', rarity: 'common', price: 100, animated: false, theme: 'neutral' },
  { id: 'bframe_gold', type: 'bannerFrame', nameKey: 'cosmeticBframeGold', rarity: 'rare', price: 320, animated: false, theme: 'neutral' },
  { id: 'bframe_space', type: 'bannerFrame', nameKey: 'cosmeticBframeSpace', rarity: 'rare', price: 420, animated: true, theme: 'space' },
  { id: 'bframe_orbit', type: 'bannerFrame', nameKey: 'cosmeticBframeOrbit', rarity: 'epic', price: 850, animated: true, theme: 'space' },
  { id: 'bframe_lava', type: 'bannerFrame', nameKey: 'cosmeticBframeLava', rarity: 'epic', price: 900, animated: true, theme: 'fire' },
  { id: 'bframe_reef', type: 'bannerFrame', nameKey: 'cosmeticBframeReef', rarity: 'rare', price: 380, animated: false, theme: 'ocean' },
  { id: 'bframe_aurora', type: 'bannerFrame', nameKey: 'cosmeticBframeAurora', rarity: 'legendary', price: 1600, animated: true, theme: 'aurora' },

  // —— Cercles autour de la photo ——
  { id: 'frame_white', type: 'avatar', nameKey: 'cosmeticFrameWhite', rarity: 'common', price: 100, animated: false, theme: 'neutral' },
  { id: 'frame_gold', type: 'avatar', nameKey: 'cosmeticFrameGold', rarity: 'rare', price: 300, animated: false, theme: 'neutral' },
  { id: 'frame_neon', type: 'avatar', nameKey: 'cosmeticFrameNeon', rarity: 'rare', price: 500, animated: true, theme: 'neutral' },
  { id: 'frame_space', type: 'avatar', nameKey: 'cosmeticFrameSpace', rarity: 'rare', price: 480, animated: true, theme: 'space' },
  { id: 'frame_reef', type: 'avatar', nameKey: 'cosmeticFrameReef', rarity: 'rare', price: 360, animated: false, theme: 'ocean' },
  { id: 'frame_rainbow', type: 'avatar', nameKey: 'cosmeticFrameRainbow', rarity: 'epic', price: 900, animated: true, theme: 'aurora' },
  { id: 'frame_lava', type: 'avatar', nameKey: 'cosmeticFrameLava', rarity: 'epic', price: 950, animated: true, theme: 'fire' },
  { id: 'frame_orbit', type: 'avatar', nameKey: 'cosmeticFrameOrbit', rarity: 'epic', price: 1000, animated: true, theme: 'space' },
  { id: 'frame_flames', type: 'avatar', nameKey: 'cosmeticFrameFlames', rarity: 'legendary', price: 1500, animated: true, theme: 'fire' },
  { id: 'frame_sparks', type: 'avatar', nameKey: 'cosmeticFrameSparks', rarity: 'legendary', price: 2000, animated: true, theme: 'aurora' },
];

const BY_ID = new Map(PROFILE_COSMETICS.map((c) => [c.id, c]));
const SHOP_BANNER_IDS = new Set(
  PROFILE_COSMETICS.filter((c) => c.type === 'banner').map((c) => c.id),
);
const BANNER_FRAME_IDS = new Set(
  PROFILE_COSMETICS.filter((c) => c.type === 'bannerFrame').map((c) => c.id),
);
const AVATAR_RING_IDS = new Set(
  PROFILE_COSMETICS.filter((c) => c.type === 'avatar').map((c) => c.id),
);

export const COSMETIC_SHOP_SECTIONS: { type: CosmeticType; titleKey: TranslationKey }[] = [
  { type: 'banner', titleKey: 'shopCosmeticCatBanner' },
  { type: 'bannerFrame', titleKey: 'shopCosmeticCatBannerFrame' },
  { type: 'avatar', titleKey: 'shopCosmeticCatAvatar' },
];

export function getCosmetic(id: string): ProfileCosmeticDef | undefined {
  return BY_ID.get(id as ProfileCosmeticId);
}

export function isShopBannerId(id: string): id is ShopBannerId {
  return SHOP_BANNER_IDS.has(id as ProfileCosmeticId);
}

export function isBannerFrameId(id: string): id is BannerFrameId {
  return BANNER_FRAME_IDS.has(id as BannerFrameId);
}

export function isProfileFrameId(id: string): id is AvatarRingId {
  return AVATAR_RING_IDS.has(id as AvatarRingId);
}

export function getOwnedCosmetics(): string[] {
  const list = loadWalletRaw().ownedCosmetics;
  return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
}

export function ownsCosmetic(id: string): boolean {
  return getOwnedCosmetics().includes(id);
}

export function grantCosmetic(id: string): void {
  const w = loadWalletRaw();
  const owned = Array.isArray(w.ownedCosmetics) ? w.ownedCosmetics : [];
  if (owned.includes(id)) return;
  w.ownedCosmetics = [...owned, id];
  saveWalletRaw(w);
}

export function rarityLabelKey(rarity: CosmeticRarity): TranslationKey {
  if (rarity === 'common') return 'cosmeticRarityCommon';
  if (rarity === 'rare') return 'cosmeticRarityRare';
  if (rarity === 'epic') return 'cosmeticRarityEpic';
  return 'cosmeticRarityLegendary';
}

function sortForShop(list: ProfileCosmeticDef[]): ProfileCosmeticDef[] {
  const owned = new Set(getOwnedCosmetics());
  return [...list].sort((a, b) => {
    const ao = owned.has(a.id) ? 1 : 0;
    const bo = owned.has(b.id) ? 1 : 0;
    if (ao !== bo) return ao - bo;
    return a.price - b.price;
  });
}

/** @deprecated Prefer listCosmeticsByType */
export function listCosmeticsForShop(): ProfileCosmeticDef[] {
  return sortForShop([...PROFILE_COSMETICS]);
}

export function listCosmeticsByType(type: CosmeticType): ProfileCosmeticDef[] {
  return sortForShop(PROFILE_COSMETICS.filter((c) => c.type === type));
}

export function canUseShopBanner(id: string): boolean {
  return isShopBannerId(id) && ownsCosmetic(id);
}

export function canUseFrame(id: string): boolean {
  return isProfileFrameId(id) && ownsCosmetic(id);
}

export function canUseBannerFrame(id: string): boolean {
  return isBannerFrameId(id) && ownsCosmetic(id);
}

export function getAvatarFrame(): AvatarRingId | null {
  const profile = getProfile();
  const raw = profile?.avatarFrame;
  if (typeof raw !== 'string' || !raw) return null;
  if (isProfileFrameId(raw) && canUseFrame(raw)) return raw;
  return null;
}

export function setAvatarFrame(id: AvatarRingId | null): boolean {
  const profile = getProfile();
  if (!profile) return false;
  if (id != null && !canUseFrame(id)) return false;
  saveProfileRaw({
    ...profile,
    avatarFrame: id,
    profileUpdatedAt: Date.now(),
  });
  void import('./sync').then((m) => void m.pushUserData());
  void import('./social/publicProfile').then((m) => void m.syncPublicProfile());
  return true;
}

export function getBannerFrame(): BannerFrameId | null {
  const profile = getProfile();
  const raw = profile?.bannerFrame;
  if (typeof raw !== 'string' || !raw) return null;
  if (isBannerFrameId(raw) && canUseBannerFrame(raw)) return raw;
  return null;
}

export function setBannerFrame(id: BannerFrameId | null): boolean {
  const profile = getProfile();
  if (!profile) return false;
  if (id != null && !canUseBannerFrame(id)) return false;
  saveProfileRaw({
    ...profile,
    bannerFrame: id,
    profileUpdatedAt: Date.now(),
  });
  void import('./sync').then((m) => void m.pushUserData());
  void import('./social/publicProfile').then((m) => void m.syncPublicProfile());
  return true;
}

function saveBannerTheme(id: string): boolean {
  const profile = getProfile();
  if (!profile) return false;
  saveProfileRaw({
    ...profile,
    bannerTheme: id,
    profileUpdatedAt: Date.now(),
  });
  void import('./sync').then((m) => void m.pushUserData());
  void import('./social/publicProfile').then((m) => void m.syncPublicProfile());
  return true;
}

export function equipCosmetic(id: ProfileCosmeticId): boolean {
  if (!ownsCosmetic(id)) return false;
  const def = getCosmetic(id);
  if (!def) return false;
  if (def.type === 'banner') return saveBannerTheme(id);
  if (def.type === 'bannerFrame') return setBannerFrame(id as BannerFrameId);
  return setAvatarFrame(id as AvatarRingId);
}

export function unequipFrame(): boolean {
  return setAvatarFrame(null);
}

export function unequipBannerFrame(): boolean {
  return setBannerFrame(null);
}

export function mergeOwnedCosmetics(local: string[] | undefined, cloud: unknown): string[] {
  const a = Array.isArray(local) ? local.filter((x) => typeof x === 'string') : [];
  const b = Array.isArray(cloud) ? cloud.filter((x): x is string => typeof x === 'string') : [];
  return [...new Set([...a, ...b])];
}
