/** Keys that belong to a logged-in user's progress (not preferences). */
export const USER_DATA_KEYS = [
  'scanplay-history',
  'scanplay-gamification',
  'scanplay-mistakes',
  'scanplay-best',
  'scanplay-multi-scans',
  'scanplay-exam-passes',
  'scanplay-scans-day',
  'scanplay-difficult',
  'scanplay-notifications',
  'scanplay-achievement-unlocks',
  'scanplay-profile',
  'scanplay-exam-history',
  'scanplay-wallet',
  'scanplay-plan',
  'scanplay-billing',
  'scanplay-plan-user',
  'scanplay-sub-period-end',
  'scanplay-sub-cancel-at-end',
] as const;

export function clearLocalUserData(): void {
  for (const key of USER_DATA_KEYS) {
    localStorage.removeItem(key);
  }
}
