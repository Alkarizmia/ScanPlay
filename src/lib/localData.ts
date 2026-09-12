/** Keys that belong to a logged-in user's progress (not device prefs). */
export const USER_DATA_KEYS = [
  'scanplay-history',
  'scanplay-gamification',
  'scanplay-mistakes',
  'scanplay-best',
  'scanplay-multi-scans',
  'scanplay-exam-passes',
  'scanplay-scans-day',
  'scanplay-plays-day',
  'scanplay-mission-claims',
  'scanplay-difficult',
  'scanplay-notifications',
  'scanplay-achievement-unlocks',
  'scanplay-profile',
  'scanplay-lesson-checkpoint',
  'scanplay-wallet',
  'scanplay-plan',
  'scanplay-billing',
  'scanplay-plan-user',
  'scanplay-sub-period-end',
  'scanplay-sub-cancel-at-end',
  'scanplay-exam-history',
  'scanplay-path-chests',
  'scanplay-friend-count',
  'scanplay-synthesis-month',
  'scanplay-last-home-deck',
] as const;

/** Device-level ScanPlay keys kept after account deletion. */
const ACCOUNT_DELETE_KEEP = new Set(['scanplay-theme', 'scanplay-preferences', 'scanplay-ads-consent']);

export function clearLocalUserData(): void {
  for (const key of USER_DATA_KEYS) {
    localStorage.removeItem(key);
  }
}

function removeMatchingStorage(storage: Storage, predicate: (key: string) => boolean): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key) keys.push(key);
  }
  for (const key of keys) {
    if (predicate(key)) storage.removeItem(key);
  }
}

/** Clears ScanPlay account data in this browser after the user deletes their account. */
export function clearAccountLocalData(): void {
  clearLocalUserData();
  try {
    removeMatchingStorage(localStorage, (key) => {
      if (ACCOUNT_DELETE_KEEP.has(key)) return false;
      if (key.startsWith('scanplay-')) return true;
      if (key.startsWith('sb-') && key.includes('auth-token')) return true;
      return false;
    });
    removeMatchingStorage(sessionStorage, (key) => {
      if (key.startsWith('scanplay-')) return true;
      if (key === 'sp-audio-launched') return true;
      if (key.startsWith('sb-') && key.includes('auth-token')) return true;
      return false;
    });
  } catch {
    /* storage unavailable */
  }
}
