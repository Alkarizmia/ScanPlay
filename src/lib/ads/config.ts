/** Durée minimale d'affichage avant de créditer les ScanCoins (web AdSense). */
export const WEB_REWARDED_VIEW_SECONDS = 15;

function envFlag(value: string | undefined, defaultOn = false): boolean {
  if (value == null || value === '') return defaultOn;
  return value === '1' || value.toLowerCase() === 'true';
}

/** AdSense ne sert pas de pubs en dev local (localhost / LAN). */
function isPrivateDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return true;
  if (/^192\.168\.\d+\.\d+$/.test(h)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h)) return true;
  return false;
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
  // AdSense ne remplit jamais localhost / LAN — forcer la simulation en dev local
  if (import.meta.env.DEV && isPrivateDevHost()) return false;
  const defaultOn = !import.meta.env.DEV;
  if (!envFlag(import.meta.env.VITE_ADSENSE_ENABLED, defaultOn)) return false;
  return getAdSenseClientId() != null;
}

export function isWebRewardedAdLive(): boolean {
  return isAdSenseEnabled() && getAdSenseRewardSlot() != null;
}

/** Mode dev : simulation si pas de client AdSense configuré. */
export function isAdSimulationMode(): boolean {
  return !isWebRewardedAdLive();
}
