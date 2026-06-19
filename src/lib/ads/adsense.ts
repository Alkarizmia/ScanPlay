import { getAdSenseClientId } from './config';
import { waitForAdStorageConsent, AD_CONSENT_GRANTED_EVENT } from './consent';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let scriptPromise: Promise<void> | null = null;
const pushedIns = new WeakSet<HTMLElement>();

function initAdsQueue(): void {
  window.adsbygoogle = window.adsbygoogle || [];
}

function waitForScriptElement(script: HTMLScriptElement): Promise<void> {
  if (script.dataset.scanplayAdsenseReady === '1') return Promise.resolve();

  return new Promise((resolve, reject) => {
    const finish = () => {
      script.dataset.scanplayAdsenseReady = '1';
      initAdsQueue();
      resolve();
    };

    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => reject(new Error('adsense_script_error')), { once: true });

    // Déjà en cache / exécuté avant les listeners
    window.setTimeout(() => {
      if (script.dataset.scanplayAdsenseReady === '1') return;
      if (window.adsbygoogle) finish();
    }, 50);
  });
}

export function ensureAdSenseScript(): Promise<void> {
  const clientId = getAdSenseClientId();
  if (!clientId) return Promise.reject(new Error('adsense_not_configured'));

  if (typeof window === 'undefined') return Promise.reject(new Error('no_window'));

  initAdsQueue();

  const headScript = document.querySelector('script[src*="adsbygoogle.js"]') as HTMLScriptElement | null;
  if (headScript) {
    return waitForScriptElement(headScript);
  }

  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-scanplay-adsense]') as HTMLScriptElement | null;
    if (existing) {
      void waitForScriptElement(existing).then(resolve).catch(reject);
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-scanplay-adsense', '1');
    script.onload = () => {
      script.dataset.scanplayAdsenseReady = '1';
      initAdsQueue();
      resolve();
    };
    script.onerror = () => reject(new Error('adsense_script_error'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function pushAdSenseSlot(): void {
  initAdsQueue();
  try {
    window.adsbygoogle!.push({});
  } catch {
    /* slot may already be filled */
  }
}

/** Attend qu'une balise <ins> soit remplie ou timeout. */
export function watchInsAdFill(ins: HTMLElement, timeoutMs = 12000): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();

    const check = () => {
      const status = ins.getAttribute('data-ad-status');
      if (status === 'filled' || ins.querySelector('iframe')) {
        resolve(true);
        return;
      }
      if (status === 'unfilled') {
        resolve(false);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(ins.querySelector('iframe') != null);
        return;
      }
      window.setTimeout(check, 400);
    };

    check();
  });
}

/** Charge une unité pub après consentement + script. */
export async function loadAdUnit(ins: HTMLElement): Promise<boolean> {
  const ok = await waitForAdStorageConsent();
  if (!ok) return false;

  await ensureAdSenseScript();
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  if (!pushedIns.has(ins)) {
    pushedIns.add(ins);
    pushAdSenseSlot();
  }

  return watchInsAdFill(ins, 16000);
}

export function onAdConsentGranted(listener: () => void): () => void {
  window.addEventListener(AD_CONSENT_GRANTED_EVENT, listener);
  return () => window.removeEventListener(AD_CONSENT_GRANTED_EVENT, listener);
}
