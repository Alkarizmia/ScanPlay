import { getUserId, isLoggedIn } from './auth';
import { isDisplayNameAvailable, syncPublicProfileWithDisplayName } from './social/publicProfile';
import { isSupabaseConfigured } from './supabase';

const KEY = 'scanplay-profile';

export type AvatarId = 'avatar1' | 'avatar2' | 'avatar3' | 'avatar4' | 'custom';

export interface UserProfileData {
  displayName: string;
  avatar: AvatarId;
  customAvatarData?: string;
  profileUpdatedAt?: number;
}

export const DEFAULT_AVATARS: { id: AvatarId; emoji: string }[] = [
  { id: 'avatar1', emoji: '🎮' },
  { id: 'avatar2', emoji: '🦊' },
  { id: 'avatar3', emoji: '🌟' },
  { id: 'avatar4', emoji: '🚀' },
];

function hashSuffix(userId: string): string {
  const compact = userId.replace(/-/g, '');
  let sum = 0;
  for (let i = 0; i < compact.length; i += 1) {
    sum = (sum + compact.charCodeAt(i) * (i + 1)) % 10000;
  }
  return String(sum).padStart(4, '0');
}

export function defaultDisplayName(userId: string): string {
  return `ID-${hashSuffix(userId)}`;
}

export function loadProfileRaw(): UserProfileData | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function saveProfileRaw(data: UserProfileData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function ensureUserProfile(userId: string): UserProfileData {
  const existing = loadProfileRaw();
  if (existing?.displayName) return existing;

  const profile: UserProfileData = {
    displayName: defaultDisplayName(userId),
    avatar: 'avatar1',
  };
  saveProfileRaw(profile);
  void import('./sync').then((m) => m.scheduleSync());
  return profile;
}

export function getProfile(): UserProfileData | null {
  if (!isLoggedIn()) return null;
  const userId = getUserId();
  if (!userId) return null;
  return loadProfileRaw() ?? ensureUserProfile(userId);
}

export type SetDisplayNameResult =
  | { ok: true }
  | { ok: false; error: 'not_logged_in' | 'too_short' | 'display_name_taken' | 'sync_failed' };

export function setDisplayName(name: string): void {
  void trySetDisplayName(name);
}

export async function trySetDisplayName(name: string): Promise<SetDisplayNameResult> {
  const profile = getProfile();
  if (!profile) return { ok: false, error: 'not_logged_in' };
  const trimmed = name.trim().slice(0, 24);
  if (trimmed.length < 2) return { ok: false, error: 'too_short' };
  if (trimmed === profile.displayName) return { ok: true };

  if (isSupabaseConfigured && isLoggedIn()) {
    const available = await isDisplayNameAvailable(trimmed);
    if (available !== true) {
      return { ok: false, error: available === false ? 'display_name_taken' : 'sync_failed' };
    }

    const sync = await syncPublicProfileWithDisplayName(trimmed);
    if (!sync.ok) {
      if (sync.code === 'display_name_taken' || sync.code === 'display_name_invalid') {
        return { ok: false, error: 'display_name_taken' };
      }
      return { ok: false, error: 'sync_failed' };
    }
  }

  saveProfileRaw({ ...profile, displayName: trimmed, profileUpdatedAt: Date.now() });
  void import('./sync').then((m) => m.scheduleSync());
  return { ok: true };
}

export function setAvatar(avatar: AvatarId, customAvatarData?: string): void {
  const profile = getProfile();
  if (!profile) return;
  saveProfileRaw({
    ...profile,
    avatar,
    customAvatarData: avatar === 'custom' ? customAvatarData : undefined,
    profileUpdatedAt: Date.now(),
  });
  void import('./sync').then((m) => {
    void m.pushUserData();
  });
  void import('./social/publicProfile').then((m) => void m.syncPublicProfile());
}

export interface CloudProfilePatch {
  displayName?: string | null;
  avatarId?: string | null;
  avatarUrl?: string | null;
  updatedAt?: string | null;
}

function isAvatarId(value: string | null | undefined): value is AvatarId {
  return value === 'avatar1' || value === 'avatar2' || value === 'avatar3' || value === 'avatar4' || value === 'custom';
}

/** Merge avatar / name from cloud when newer than local copy. */
export function mergeProfileFromCloud(patch: CloudProfilePatch): void {
  if (!isLoggedIn()) return;
  const userId = getUserId();
  if (!userId) return;

  const local = loadProfileRaw() ?? ensureUserProfile(userId);
  const cloudTime = patch.updatedAt ? Date.parse(patch.updatedAt) : 0;
  const localTime = local.profileUpdatedAt ?? 0;
  const avatarDiffers =
    (patch.avatarUrl && patch.avatarUrl !== local.customAvatarData) ||
    (patch.avatarId && isAvatarId(patch.avatarId) && patch.avatarId !== local.avatar);

  if (cloudTime > 0 && localTime > cloudTime && !avatarDiffers) return;

  const next: UserProfileData = { ...local };
  let changed = false;

  if (patch.displayName?.trim() && patch.displayName.trim() !== local.displayName) {
    next.displayName = patch.displayName.trim().slice(0, 24);
    changed = true;
  }

  if (patch.avatarId && isAvatarId(patch.avatarId) && patch.avatarId !== local.avatar) {
    next.avatar = patch.avatarId;
    if (patch.avatarId !== 'custom') {
      next.customAvatarData = undefined;
    }
    changed = true;
  }

  if (patch.avatarId === 'custom' && patch.avatarUrl) {
    next.avatar = 'custom';
    next.customAvatarData = patch.avatarUrl;
    changed = true;
  } else if (patch.avatarUrl && next.avatar === 'custom' && patch.avatarUrl !== local.customAvatarData) {
    next.customAvatarData = patch.avatarUrl;
    changed = true;
  }

  if (!changed) return;

  next.profileUpdatedAt = cloudTime > 0 ? cloudTime : Date.now();
  saveProfileRaw(next);
}

export function getAvatarEmoji(profile: UserProfileData): string {
  if (profile.avatar === 'custom' && profile.customAvatarData) return '';
  return DEFAULT_AVATARS.find((a) => a.id === profile.avatar)?.emoji ?? '🎮';
}
