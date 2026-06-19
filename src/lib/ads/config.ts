/** Durée minimale d'affichage avant de créditer les ScanCoins (web AdSense). */
export const WEB_REWARDED_VIEW_SECONDS = 15;

function envFlag(value: string | undefined, defaultOn = false): boolean {
  if (value == null || value === '') return defaultOn;
  return value === '1' || value.toLowerCase() === 'true';
}

/** Ex: ca-pub-1234567890123456 */
export function getAdSenseClientId(): string | null {
  const raw = import.meta.env.VITE_ADSENSE_CLIENT?.trim();
  if (raw) return raw;
  return 'ca-pub-6135402548418867';
}

export function getAdSenseShopSlot(): string | null {
  const raw = import.meta.env.VITE_ADSENSE_SLOT_SHOP?.trim();
  if (raw) return raw;
  return '5703877107';
}

export function getAdSenseRewardSlot(): string | null {
  const raw = import.meta.env.VITE_ADSENSE_SLOT_REWARD?.trim();
  if (raw) return raw;
  return getAdSenseShopSlot();
}

export function isAdSenseEnabled(): boolean {
  if (!envFlag(import.meta.env.VITE_ADSENSE_ENABLED, true)) return false;
  return getAdSenseClientId() != null;
}

export function isWebRewardedAdLive(): boolean {
  return isAdSenseEnabled() && getAdSenseRewardSlot() != null;
}

/** Mode dev : simulation si pas de client AdSense configuré. */
export function isAdSimulationMode(): boolean {
  return !isWebRewardedAdLive();
}
