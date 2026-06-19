const KEY = 'scanplay-preferences';

export interface UserPreferences {
  sound: boolean;
  music: boolean;
  notifications: boolean;
  /** 0–100 */
  masterVolume: number;
  vibration: boolean;
}

const DEFAULTS: UserPreferences = {
  sound: true,
  music: false,
  notifications: true,
  masterVolume: 85,
  vibration: true,
};

export function getPreferences(): UserPreferences {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const rawVolume = Number(data.masterVolume);
    return {
      sound: data.sound ?? DEFAULTS.sound,
      music: data.music ?? DEFAULTS.music,
      notifications: data.notifications ?? DEFAULTS.notifications,
      masterVolume:
        Number.isFinite(rawVolume) ? Math.min(100, Math.max(0, Math.round(rawVolume))) : DEFAULTS.masterVolume,
      vibration: data.vibration ?? DEFAULTS.vibration,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

const listeners = new Set<() => void>();

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyPreferenceChange(): void {
  listeners.forEach((fn) => fn());
}

export function setPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K],
): void {
  const prefs = getPreferences();
  if (prefs[key] === value) return;
  prefs[key] = value;
  localStorage.setItem(KEY, JSON.stringify(prefs));
  notifyPreferenceChange();
}

export function isSoundEnabled(): boolean {
  return getPreferences().sound;
}

export function isMusicEnabled(): boolean {
  return getPreferences().music;
}

export function areNotificationsEnabled(): boolean {
  return getPreferences().notifications;
}

export function isVibrationEnabled(): boolean {
  return getPreferences().vibration;
}

/** 0–1 multiplier applied to all SFX and music. */
export function getMasterVolumeMultiplier(): number {
  return getPreferences().masterVolume / 100;
}
