/** Attente locale avant de créditer les ScanCoins (pas d’unité AdSense). */
export const WEB_REWARDED_VIEW_SECONDS = 3;

/**
 * Pause l’UI pub (bandeau, boutique, confidentialité). Les variables VITE_ADSENSE_* restent.
 * Laisser true tant qu’il n’y a pas de pages éditoriales riches pour AdSense.
 */
export const ADSENSE_UI_PAUSED = true;

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
  if (ADSENSE_UI_PAUSED) return false;
  // AdSense ne remplit jamais localhost / LAN — forcer la simulation en dev local
  if (import.meta.env.DEV && isPrivateDevHost()) return false;
  const defaultOn = !import.meta.env.DEV;
  if (!envFlag(import.meta.env.VITE_ADSENSE_ENABLED, defaultOn)) return false;
  return getAdSenseClientId() != null;
}

/**
 * AdSense web n’autorise pas de pubs sur overlay / écrans sans contenu éditeur.
 * Les pièces gratuites passent toujours par un timer local (simulation).
 */
export function isWebRewardedAdLive(): boolean {
  return false;
}

/** Toujours true : pas de vraie unité Google pour le reward web. */
export function isAdSimulationMode(): boolean {
  return true;
}
