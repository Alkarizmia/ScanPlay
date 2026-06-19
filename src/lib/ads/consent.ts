/**
 * Consentement pub (Consent Mode v2) — requis en EEE/UK/CH.
 * Sans consentement explicite, Google AdSense ne sert aucune annonce.
 */

const CONSENT_KEY = 'scanplay-ads-consent';
export const AD_CONSENT_GRANTED_EVENT = 'scanplay-ad-consent-granted';

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { gtag?: GtagFn; dataLayer?: unknown[] };
  if (w.gtag) return w.gtag;
  if (w.dataLayer) {
    return (...args: unknown[]) => {
      w.dataLayer!.push(args);
    };
  }
  return null;
}

function updateConsentMode(granted: boolean): void {
  const gtag = getGtag();
  if (!gtag) return;
  if (granted) {
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
  } else {
    gtag('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }
}

/** Restaure le consentement sauvegardé — à appeler dans index.html avant adsbygoogle.js */
export function restoreSavedAdConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(CONSENT_KEY) === 'granted') {
      updateConsentMode(true);
    }
  } catch {
    /* private mode */
  }
}

export function hasAdConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}

export function grantAdConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, 'granted');
  } catch {
    /* ignore */
  }
  updateConsentMode(true);
  window.dispatchEvent(new CustomEvent(AD_CONSENT_GRANTED_EVENT));
}

export function revokeAdConsent(): void {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* ignore */
  }
  updateConsentMode(false);
}

/** @deprecated use grantAdConsent / revokeAdConsent */
export function setAdConsent(accepted: boolean): void {
  if (accepted) grantAdConsent();
  else revokeAdConsent();
}

const EEA_LANG_PREFIXES = ['fr', 'nl', 'de', 'es', 'it', 'pt', 'pl', 'en-gb'];

/** Bandeau requis tant que l'utilisateur n'a pas accepté (zone EEE probable). */
export function needsAdConsentPrompt(): boolean {
  if (hasAdConsent()) return false;
  if (typeof window === 'undefined') return false;

  const lang = (navigator.language ?? '').toLowerCase();
  const langs = (navigator.languages ?? []).map((l) => l.toLowerCase());
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';

  const langMatch = EEA_LANG_PREFIXES.some(
    (p) => lang.startsWith(p) || langs.some((l) => l.startsWith(p)),
  );
  const tzMatch = tz.startsWith('Europe/') && !tz.startsWith('Europe/Kyiv');
  return langMatch || tzMatch;
}

/** Attend le consentement avant de charger une unité pub. */
export function waitForAdStorageConsent(timeoutMs = 20000): Promise<boolean> {
  if (hasAdConsent()) return Promise.resolve(true);
  if (!needsAdConsentPrompt()) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener(AD_CONSENT_GRANTED_EVENT, onGrant);
      resolve(ok);
    };

    const onGrant = () => finish(true);
    window.addEventListener(AD_CONSENT_GRANTED_EVENT, onGrant);

    const api = (window as Window & { __tcfapi?: (...args: unknown[]) => void }).__tcfapi;
    if (api) {
      api('getTCData', 2, (tcData: { gdprApplies?: boolean; eventStatus?: string } | null, success: boolean) => {
        if (!success || !tcData?.gdprApplies) return;
        if (tcData.eventStatus === 'tcloaded' || tcData.eventStatus === 'useractioncomplete') {
          finish(true);
        }
      });
    }

    window.setTimeout(() => finish(hasAdConsent()), timeoutMs);
  });
}
