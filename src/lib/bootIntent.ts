export type BootIntent = 'scan' | 'auth';

const KEY = 'scanplay-boot-intent';
const PENDING_SCAN_KEY = 'scanplay-pending-scan-after-auth';
const PENDING_PROFILE_KEY = 'scanplay-pending-profile';
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

export function setPendingProfileName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    sessionStorage.setItem(PENDING_PROFILE_KEY, trimmed);
  } catch {
    /* private mode */
  }
}

export function consumePendingProfileName(): string | null {
  try {
    const value = sessionStorage.getItem(PENDING_PROFILE_KEY);
    sessionStorage.removeItem(PENDING_PROFILE_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export function peekPendingProfileName(): string | null {
  try {
    return sessionStorage.getItem(PENDING_PROFILE_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Read ?intent=scan|auth and/or ?profile=Name from the URL, clear them, and stash.
 * Returns the boot intent if present (profile-only links still open the app via Root).
 */
export function applyUrlBootIntent(): BootIntent | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const intentRaw = params.get('intent');
    const profile = params.get('profile');
    let intent: BootIntent | null = null;

    if (profile?.trim()) {
      setPendingProfileName(profile);
      params.delete('profile');
    }

    if (intentRaw === 'scan' || intentRaw === 'auth') {
      intent = intentRaw;
      params.delete('intent');
      setBootIntent(intent);
    }

    if (!profile?.trim() && !intent) return null;

    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next || '/');
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
