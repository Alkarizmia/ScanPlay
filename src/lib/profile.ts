import { getUserId, isLoggedIn } from './auth';
import { isDisplayNameAvailable, syncPublicProfileWithDisplayName } from './social/publicProfile';
import { isSupabaseConfigured } from './supabase';

const KEY = 'scanplay-profile';

export type AvatarId = 'avatar1' | 'avatar2' | 'avatar3' | 'avatar4' | 'custom';

export interface UserProfileData {
  displayName: string;
  avatar: AvatarId;
  customAvatarData?: string;
  /** Background behind the profile photo (green/red/blue/yellow free; chromatic Plus+; shop ids). */
  bannerTheme?: string;
  /** Cercle autour de la photo (id shop) ou null / absent = aucun. */
  avatarFrame?: string | null;
  /** Cadre autour du fond / hero (id shop) ou null / absent = aucun. */
  bannerFrame?: string | null;
  profileUpdatedAt?: number;
  /** Timestamp of last successful custom display-name change (for 7-day cooldown). */
  displayNameChangedAt?: number;
  /** Tuto Profil « choisis ton pseudo » déjà vu ou skippé. */
  pseudoOnboardingDone?: boolean;
}

export const DISPLAY_NAME_MIN = 5;
export const DISPLAY_NAME_MAX = 20;
export const DISPLAY_NAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

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

/** Auto-generated fallback name (ID-1234) — not a user-chosen pseudo. */
export function isDefaultDisplayName(name: string, userId?: string | null): boolean {
  const trimmed = name.trim();
  if (/^ID-\d{4}$/i.test(trimmed)) return true;
  if (userId && trimmed === defaultDisplayName(userId)) return true;
  return false;
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
  | {
      ok: false;
      error: 'not_logged_in' | 'too_short' | 'too_long' | 'display_name_taken' | 'sync_failed' | 'cooldown';
      cooldownMsLeft?: number;
    };

export function setDisplayName(name: string): void {
  void trySetDisplayName(name);
}

/** Remaining ms before the next rename is allowed, or 0 if rename is free. */
export function getDisplayNameCooldownMsLeft(profile?: UserProfileData | null): number {
  const data = profile ?? getProfile();
  if (!data) return 0;
  const userId = getUserId();
  if (userId && isDefaultDisplayName(data.displayName, userId)) return 0;
  const changedAt = data.displayNameChangedAt;
  if (!changedAt) return 0;
  return Math.max(0, changedAt + DISPLAY_NAME_COOLDOWN_MS - Date.now());
}

export async function trySetDisplayName(name: string): Promise<SetDisplayNameResult> {
  const profile = getProfile();
  if (!profile) return { ok: false, error: 'not_logged_in' };
  const trimmed = name.trim();
  if (trimmed.length < DISPLAY_NAME_MIN) return { ok: false, error: 'too_short' };
  if (trimmed.length > DISPLAY_NAME_MAX) return { ok: false, error: 'too_long' };
  if (trimmed === profile.displayName) return { ok: true };

  const cooldownLeft = getDisplayNameCooldownMsLeft(profile);
  if (cooldownLeft > 0) {
    return { ok: false, error: 'cooldown', cooldownMsLeft: cooldownLeft };
  }

  if (isSupabaseConfigured && isLoggedIn()) {
    const available = await isDisplayNameAvailable(trimmed);
    // false = réellement pris ; null = erreur réseau / RPC (ne pas confondre avec "pris")
    if (available === false) {
      return { ok: false, error: 'display_name_taken' };
    }
    if (available === null) {
      return { ok: false, error: 'sync_failed' };
    }

    const sync = await syncPublicProfileWithDisplayName(trimmed);
    if (!sync.ok) {
      if (sync.code === 'display_name_taken') {
        return { ok: false, error: 'display_name_taken' };
      }
      if (sync.code === 'display_name_invalid') {
        return {
          ok: false,
          error: trimmed.length > DISPLAY_NAME_MAX ? 'too_long' : 'too_short',
        };
      }
      return { ok: false, error: 'sync_failed' };
    }
  }

  const now = Date.now();
  const userId = getUserId();
  const becomingCustom = !userId || !isDefaultDisplayName(trimmed, userId);
  saveProfileRaw({
    ...profile,
    displayName: trimmed,
    profileUpdatedAt: now,
    displayNameChangedAt: becomingCustom ? now : profile.displayNameChangedAt,
  });
  if (userId && !isDefaultDisplayName(trimmed, userId)) {
    markPseudoOnboardingDoneLocal();
    void completePseudoOnboarding();
  }
  const { pushUserData } = await import('./sync');
  await pushUserData();
  const { refreshProfileCacheFromProfile } = await import('./auth');
  refreshProfileCacheFromProfile();
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
  bannerTheme?: string | null;
  avatarFrame?: string | null;
  bannerFrame?: string | null;
  updatedAt?: string | null;
}

function isAvatarId(value: string | null | undefined): value is AvatarId {
  return value === 'avatar1' || value === 'avatar2' || value === 'avatar3' || value === 'avatar4' || value === 'custom';
}

/** Merge avatar / name / cosmetics from cloud when newer than local, or when local field is empty. */
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

  const cloudWins = cloudTime > localTime || localTime === 0;
  const skipIdentity = cloudTime > 0 && localTime > cloudTime && !avatarDiffers;

  const next: UserProfileData = { ...local };
  let changed = false;

  if (!skipIdentity) {
    if (patch.displayName?.trim() && patch.displayName.trim() !== local.displayName) {
      const cloudName = patch.displayName.trim().slice(0, 24);
      const localCustom = !isDefaultDisplayName(local.displayName, userId);
      const cloudDefault = isDefaultDisplayName(cloudName, userId);
      const cloudNewer = cloudTime > localTime || localTime === 0;

      if (cloudDefault && localCustom) {
        /* keep user-chosen name — ignore stale ID-xxxx from cloud */
      } else if (cloudNewer || !localCustom || !cloudDefault) {
        next.displayName = cloudName;
        changed = true;
      }
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
  }

  // Cosmétiques: ne jamais remplacer un fond custom par le défaut "green" du cloud public.
  if (patch.bannerTheme?.trim()) {
    const incoming = patch.bannerTheme.trim();
    const current = (next.bannerTheme ?? local.bannerTheme ?? '').trim();
    const wouldDowngradeToGreen =
      incoming === 'green' && current !== '' && current !== 'green';
    if (
      !wouldDowngradeToGreen &&
      incoming !== current &&
      (cloudWins || !current || current === 'green')
    ) {
      next.bannerTheme = incoming;
      changed = true;
    }
  }

  if ('avatarFrame' in patch && (cloudWins || local.avatarFrame == null || local.avatarFrame === '')) {
    const frame = patch.avatarFrame == null || patch.avatarFrame === '' ? null : String(patch.avatarFrame);
    if (frame !== (next.avatarFrame ?? local.avatarFrame ?? null)) {
      next.avatarFrame = frame;
      changed = true;
    }
  }

  if ('bannerFrame' in patch && (cloudWins || local.bannerFrame == null || local.bannerFrame === '')) {
    const frame = patch.bannerFrame == null || patch.bannerFrame === '' ? null : String(patch.bannerFrame);
    if (frame !== (next.bannerFrame ?? local.bannerFrame ?? null)) {
      next.bannerFrame = frame;
      changed = true;
    }
  }

  if (!changed) return;

  next.profileUpdatedAt = Math.max(localTime, cloudTime > 0 ? cloudTime : Date.now());
  saveProfileRaw(next);
  void import('./auth').then((m) => m.refreshProfileCacheFromProfile());
}

export function getAvatarEmoji(profile: UserProfileData): string {
  if (profile.avatar === 'custom' && profile.customAvatarData) return '';
  return DEFAULT_AVATARS.find((a) => a.id === profile.avatar)?.emoji ?? '🎮';
}

export function hasCompletedPseudoOnboarding(): boolean {
  const profile = getProfile();
  return Boolean(profile?.pseudoOnboardingDone);
}

/** Deprecated: name is chosen at signup — never show the old ID→pseudo tuto. */
export function shouldShowPseudoOnboarding(): boolean {
  return false;
}

export function markPseudoOnboardingDoneLocal(): void {
  const profile = getProfile();
  if (!profile || profile.pseudoOnboardingDone) return;
  saveProfileRaw({ ...profile, pseudoOnboardingDone: true });
}

export async function completePseudoOnboarding(): Promise<void> {
  markPseudoOnboardingDoneLocal();
  if (!isSupabaseConfigured || !isLoggedIn()) return;
  try {
    const { getSupabase } = await import('./supabase');
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.rpc('mark_pseudo_onboarding_done');
  } catch {
    /* offline — flag local, le pull cloud ne l’efface pas */
  }
}

export function applyPseudoOnboardingFromCloud(seen: boolean | null | undefined): void {
  if (!seen) return;
  markPseudoOnboardingDoneLocal();
}

export async function pullPseudoTutoFlag(): Promise<void> {
  if (!isSupabaseConfigured || !isLoggedIn()) return;
  const userId = getUserId();
  try {
    const { getSupabase } = await import('./supabase');
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    const { data } = await supabase
      .from('scanplay_profiles')
      .select('has_seen_pseudo_tuto')
      .eq('user_id', userId)
      .maybeSingle();
    if (data && (data as { has_seen_pseudo_tuto?: boolean }).has_seen_pseudo_tuto) {
      markPseudoOnboardingDoneLocal();
    }
  } catch {
    /* colonne pas encore déployée, ou hors ligne */
  }
}
