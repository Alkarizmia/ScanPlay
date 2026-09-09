export type BootIntent = 'scan' | 'auth';

const KEY = 'scanplay-boot-intent';

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
