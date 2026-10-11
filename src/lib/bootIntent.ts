export type BootIntent = 'scan' | 'auth';

const KEY = 'scanplay-boot-intent';
const PENDING_SCAN_KEY = 'scanplay-pending-scan-after-auth';
const LOCALE_BOOT_KEY = 'scanplay-boot-locale';

/**
 * Survives React Strict Mode: sessionStorage is cleared on first read, but memory
 * stays until clearBootLocale() after App has applied the locale.
 */
let bootLocaleMemory: string | null = null;

export function setBootIntent(intent: BootIntent): void {
  try {
    sessionStorage.setItem(KEY, intent);
  } catch {
    /* private mode */
  }
}

/** Landing language chosen before App mounts. App must open in the same locale. */
export function setBootLocale(locale: string): void {
  bootLocaleMemory = locale;
  try {
    sessionStorage.setItem(LOCALE_BOOT_KEY, locale);
  } catch {
    /* private mode — memory still holds the value */
  }
}

/**
 * Read the landing locale. Clears sessionStorage immediately (one-shot URL/boot),
 * but keeps in-memory value for Strict Mode remounts until clearBootLocale().
 */
export function consumeBootLocale(): string | null {
  try {
    const fromSession = sessionStorage.getItem(LOCALE_BOOT_KEY);
    if (fromSession != null) sessionStorage.removeItem(LOCALE_BOOT_KEY);
    return bootLocaleMemory ?? fromSession;
  } catch {
    return bootLocaleMemory;
  }
}

/** Drop the in-memory boot locale after App has applied it. */
export function clearBootLocale(): void {
  bootLocaleMemory = null;
  try {
    sessionStorage.removeItem(LOCALE_BOOT_KEY);
  } catch {
    /* private mode */
  }
}

export function consumeBootIntent(): BootIntent | null {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (value === 'scan' || value === 'auth') return value;
  } catch {
    /* private mode */
  }
  return null;
}

/** Read ?intent=scan|auth from the URL, clear it, and stash as boot intent. */
export function applyUrlBootIntent(): BootIntent | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const intent = params.get('intent');
    if (intent !== 'scan' && intent !== 'auth') return null;
    params.delete('intent');
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next || '/');
    setBootIntent(intent);
    return intent;
  } catch {
    return null;
  }
}

export function setPendingScanAfterAuth(): void {
  try {
    sessionStorage.setItem(PENDING_SCAN_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function consumePendingScanAfterAuth(): boolean {
  try {
    const value = sessionStorage.getItem(PENDING_SCAN_KEY);
    sessionStorage.removeItem(PENDING_SCAN_KEY);
    return value === '1';
  } catch {
    return false;
  }
}
