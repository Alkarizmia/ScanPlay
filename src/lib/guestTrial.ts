import { isLoggedIn } from './auth';

const KEY = 'scanplay-guest-scans';
const SESSION_KEY = 'scanplay-guest-play';
const GUEST_SCAN_LIMIT = 1;

function guestScansUsed(): number {
  const raw = localStorage.getItem(KEY);
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 1 free guest scan per browser/device (persists across refresh / close / re-open).
 * Does not bill the AI envelope — after signup usage starts at 0%.
 */
export function canGuestScan(): boolean {
  if (isLoggedIn()) return false;
  return guestScansUsed() < GUEST_SCAN_LIMIT;
}

export function getGuestScansRemaining(): number {
  if (isLoggedIn()) return 0;
  return Math.max(0, GUEST_SCAN_LIMIT - guestScansUsed());
}

/** Burn the single free guest slot (idempotent once used). Survives login + logout. */
export function recordGuestScan(): void {
  if (guestScansUsed() >= GUEST_SCAN_LIMIT) return;
  localStorage.setItem(KEY, String(GUEST_SCAN_LIMIT));
}

/** Parcours en cours après le scan invité (session navigateur). */
export function beginGuestPlaySession(): void {
  if (isLoggedIn()) return;
  sessionStorage.setItem(SESSION_KEY, '1');
}

export function isGuestPlaySessionActive(): boolean {
  if (isLoggedIn()) return false;
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function clearGuestPlaySession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Clear only the in-flight play session after signup.
 * Never wipe KEY — otherwise logout + refresh would grant another free scan.
 */
export function clearGuestTrial(): void {
  clearGuestPlaySession();
}
