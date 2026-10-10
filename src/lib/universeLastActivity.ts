import {
  getUniverseEnglish,
  isUniverseEnglishOnboarded,
} from './universeEnglish';
import { getUniverseDriving } from './universeDriving';

const KEY = 'scanplay-universe-last-activity';

export type UniverseActivityKind = 'english' | 'driving';

interface StoredActivity {
  kind: UniverseActivityKind;
  at: number;
}

function readStored(): StoredActivity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredActivity>;
    if (parsed.kind !== 'english' && parsed.kind !== 'driving') return null;
    const at = Number(parsed.at);
    return { kind: parsed.kind, at: Number.isFinite(at) ? at : 0 };
  } catch {
    return null;
  }
}

/** Call when the learner opens English play or the driving course. */
export function touchUniverseLastActivity(kind: UniverseActivityKind): void {
  const next: StoredActivity = { kind, at: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function getUniverseLastActivity(): StoredActivity | null {
  return readStored();
}

/**
 * What the Accueil shortcut should resume.
 * Prefers the explicitly last-touched course; falls back to newest profile update.
 */
export function resolveUniverseHomeResume(): UniverseActivityKind | null {
  const engOk = isUniverseEnglishOnboarded();
  const driveOk = getUniverseDriving().countryId != null;
  if (!engOk && !driveOk) return null;

  const stored = readStored();
  if (stored?.kind === 'driving' && driveOk) return 'driving';
  if (stored?.kind === 'english' && engOk) return 'english';

  if (engOk && driveOk) {
    const engAt = getUniverseEnglish().updatedAt || 0;
    const driveAt = getUniverseDriving().updatedAt || 0;
    return driveAt >= engAt ? 'driving' : 'english';
  }
  if (driveOk) return 'driving';
  return 'english';
}
