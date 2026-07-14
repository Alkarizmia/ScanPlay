const KEY = 'scanplay-mascot-intro-seen';

export function hasSeenMascotIntro(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}

export function markMascotIntroSeen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

const ABSENCE_KEY = 'scanplay-last-visit';
const ABSENCE_MS = 3 * 24 * 60 * 60 * 1000;

export function shouldWelcomeBack(): boolean {
  try {
    const raw = localStorage.getItem(ABSENCE_KEY);
    localStorage.setItem(ABSENCE_KEY, String(Date.now()));
    if (!raw) return false;
    const last = Number(raw);
    if (!Number.isFinite(last)) return false;
    return Date.now() - last >= ABSENCE_MS;
  } catch {
    return false;
  }
}
