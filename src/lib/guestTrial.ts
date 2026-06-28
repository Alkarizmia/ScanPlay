import { isLoggedIn } from './auth';

const KEY = 'scanplay-guest-scans';
const SESSION_KEY = 'scanplay-guest-play';
const GUEST_SCAN_LIMIT = 1;

function guestScansUsed(): number {
  const raw = localStorage.getItem(KEY);
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 1 scan gratuit sans compte (par appareil). */
export function canGuestScan(): boolean {
  if (isLoggedIn()) return false;
  return guestScansUsed() < GUEST_SCAN_LIMIT;
}

export function getGuestScansRemaining(): number {
  if (isLoggedIn()) return 0;
  return Math.max(0, GUEST_SCAN_LIMIT - guestScansUsed());
}

export function recordGuestScan(): void {
  localStorage.setItem(KEY, String(guestScansUsed() + 1));
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

export function clearGuestTrial(): void {
  localStorage.removeItem(KEY);
  clearGuestPlaySession();
}
