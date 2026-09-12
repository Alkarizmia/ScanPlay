export type BootIntent = 'scan' | 'auth';

const KEY = 'scanplay-boot-intent';
const PENDING_SCAN_KEY = 'scanplay-pending-scan-after-auth';

export function setBootIntent(intent: BootIntent): void {
  try {
    sessionStorage.setItem(KEY, intent);
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
