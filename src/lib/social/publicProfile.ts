import { getUserId, isLoggedIn } from '../auth';
import { getGamification } from '../gamification';
import { getHistory } from '../history';
import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  getProfile,
  isDefaultDisplayName,
  loadProfileRaw,
  mergeProfileFromCloud,
  mergeProfilesPreferRicher,
  saveProfileRaw,
  type AvatarId,
  type UserProfileData,
} from '../profile';
import { getPlan } from '../planLimits';
import { getSupabase, isSupabaseConfigured } from '../supabase';

export type SyncProfileResult =
  | { ok: true }
  | { ok: false; code: 'not_configured' | 'not_logged_in' | 'no_profile' | 'display_name_taken' | 'display_name_invalid' | 'sync_failed' };

function mapSyncError(message: string): SyncProfileResult {
  const lower = message.toLowerCase();
  if (lower.includes('display_name_taken')) return { ok: false, code: 'display_name_taken' };
  if (lower.includes('display_name_invalid')) return { ok: false, code: 'display_name_invalid' };
  return { ok: false, code: 'sync_failed' };
}

function profileAvatarUrl(profile: NonNullable<ReturnType<typeof getProfile>>): string | null {
  return profile.avatar === 'custom' && profile.customAvatarData ? profile.customAvatarData : null;
}

export async function pullPublicProfileFromCloud(): Promise<void> {
  if (!isSupabaseConfigured || !isLoggedIn()) return;
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return;

  const { data } = await supabase
    .from('scanplay_public_profiles')
    .select('display_name, avatar_id, avatar_url, banner_theme, avatar_frame, banner_frame, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return;

  // Identité only: ne pas tirer banner_* ici (souvent "green" stale → écrase le fond).
  mergeProfileFromCloud({
    displayName: data.display_name as string | null,
    avatarId: data.avatar_id as string | null,
    avatarUrl: data.avatar_url as string | null,
    updatedAt: data.updated_at as string | null,
  });
}

function publicRowToProfile(data: {
  display_name?: string | null;
  avatar_id?: string | null;
  avatar_url?: string | null;
  banner_theme?: string | null;
  avatar_frame?: string | null;
  banner_frame?: string | null;
  updated_at?: string | null;
}): UserProfileData {
  const avatarId = data.avatar_id;
  const avatar: AvatarId =
    avatarId === 'avatar1' ||
    avatarId === 'avatar2' ||
    avatarId === 'avatar3' ||
    avatarId === 'avatar4' ||
    avatarId === 'custom'
      ? avatarId
      : 'avatar1';
  return {
    displayName: (data.display_name ?? '').trim() || 'ID-0000',
    avatar,
    customAvatarData:
      avatar === 'custom' && data.avatar_url ? String(data.avatar_url) : undefined,
    bannerTheme: data.banner_theme?.trim() || undefined,
    avatarFrame: data.avatar_frame?.trim() || null,
    bannerFrame: data.banner_frame?.trim() || null,
    profileUpdatedAt: data.updated_at ? Date.parse(data.updated_at) || 0 : 0,
  };
}

/** Merge local with public row so XP sync cannot wipe name / photo / frames / fond. */
async function reconcileLocalWithPublicRow(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
): Promise<UserProfileData | null> {
  const local = getProfile();
  if (!local) return null;

  const { data } = await supabase
    .from('scanplay_public_profiles')
    .select('display_name, avatar_id, avatar_url, banner_theme, avatar_frame, banner_frame, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return local;

  const cloud = publicRowToProfile(data as Parameters<typeof publicRowToProfile>[0]);
  const merged = mergeProfilesPreferRicher(local, cloud, userId);
  const raw = loadProfileRaw();
  if (
    !raw ||
    merged.displayName !== raw.displayName ||
    merged.avatar !== raw.avatar ||
    (merged.customAvatarData ?? '') !== (raw.customAvatarData ?? '') ||
    (merged.bannerTheme ?? '') !== (raw.bannerTheme ?? '') ||
    (merged.avatarFrame ?? null) !== (raw.avatarFrame ?? null) ||
    (merged.bannerFrame ?? null) !== (raw.bannerFrame ?? null)
  ) {
    saveProfileRaw(merged);
  }
  return merged;
}

export async function syncPublicProfileWithDisplayName(displayName: string): Promise<SyncProfileResult> {
  if (!isSupabaseConfigured || !isLoggedIn()) return { ok: false, code: 'not_configured' };
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return { ok: false, code: 'no_profile' };

  const profile = (await reconcileLocalWithPublicRow(supabase, userId)) ?? getProfile();
  if (!profile) return { ok: false, code: 'no_profile' };

  const { xp, streak } = getGamification();
  const deckCount = getHistory().length;
  // Prefer reconciled name when caller still has a default ID after wipe.
  const trimmed = (
    isDefaultDisplayName(displayName, userId) && !isDefaultDisplayName(profile.displayName, userId)
      ? profile.displayName
      : displayName
  )
    .trim()
    .slice(0, DISPLAY_NAME_MAX);

  const bannerTheme =
    typeof profile.bannerTheme === 'string' && profile.bannerTheme.trim()
      ? profile.bannerTheme.trim()
      : 'green';
  const avatarFrame =
    typeof profile.avatarFrame === 'string' && profile.avatarFrame.trim()
      ? profile.avatarFrame.trim()
      : null;
  const bannerFrame =
    typeof profile.bannerFrame === 'string' && profile.bannerFrame.trim()
      ? profile.bannerFrame.trim()
      : null;

  const { error } = await supabase.rpc('sync_public_profile_stats', {
    p_display_name: trimmed,
    p_avatar_id: profile.avatar,
    p_xp: xp,
    p_streak: streak,
    p_deck_count: deckCount,
    p_plan: getPlan(),
    p_avatar_url: profileAvatarUrl(profile),
    p_banner_theme: bannerTheme,
    p_avatar_frame: avatarFrame,
    p_banner_frame: bannerFrame,
  });

  if (error) {
    // Fallback si RPC pas encore patché (banner / frames)
    const retry = await supabase.rpc('sync_public_profile_stats', {
      p_display_name: trimmed,
      p_avatar_id: profile.avatar,
      p_xp: xp,
      p_streak: streak,
      p_deck_count: deckCount,
      p_plan: getPlan(),
      p_avatar_url: profileAvatarUrl(profile),
      p_banner_theme: bannerTheme,
      p_avatar_frame: avatarFrame,
    });
    if (retry.error) {
      const retry2 = await supabase.rpc('sync_public_profile_stats', {
        p_display_name: trimmed,
        p_avatar_id: profile.avatar,
        p_xp: xp,
        p_streak: streak,
        p_deck_count: deckCount,
        p_plan: getPlan(),
        p_avatar_url: profileAvatarUrl(profile),
        p_banner_theme: bannerTheme,
      });
      if (retry2.error) {
        const retry3 = await supabase.rpc('sync_public_profile_stats', {
          p_display_name: trimmed,
          p_avatar_id: profile.avatar,
          p_xp: xp,
          p_streak: streak,
          p_deck_count: deckCount,
          p_plan: getPlan(),
          p_avatar_url: profileAvatarUrl(profile),
        });
        if (retry3.error) return mapSyncError(retry3.error.message);
      }
    }
  }

  // Réécrire les colonnes cosmétiques (RPC ancienne peut sanitizer les fonds boutique).
  await supabase
    .from('scanplay_public_profiles')
    .update({
      banner_theme: bannerTheme,
      avatar_frame: avatarFrame,
      banner_frame: bannerFrame,
    })
    .eq('user_id', userId);

  const { syncPublicAchievements } = await import('./publicAchievements');
  await syncPublicAchievements();
  return { ok: true };
}

export async function syncPublicProfile(): Promise<SyncProfileResult> {
  const profile = getProfile();
  if (!profile) return { ok: false, code: 'no_profile' };
  return syncPublicProfileWithDisplayName(profile.displayName);
}

export async function syncPublicProfileResolvingConflicts(): Promise<SyncProfileResult> {
  const userId = getUserId();
  let profile = getProfile();
  if (!profile) return { ok: false, code: 'no_profile' };

  if (userId && isDefaultDisplayName(profile.displayName, userId)) {
    await pullPublicProfileFromCloud();
    profile = getProfile();
    if (!profile) return { ok: false, code: 'no_profile' };
  }

  const first = await syncPublicProfileWithDisplayName(profile.displayName);
  if (first.ok) return first;
  if (first.code === 'display_name_taken') {
    await pullPublicProfileFromCloud();
    return { ok: true };
  }
  return first;
}

export async function isDisplayNameAvailable(name: string): Promise<boolean | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const trimmed = name.trim();
  // Hors plage : ne pas signaler "déjà pris" (laisse l'UI afficher trop court / trop long).
  if (trimmed.length < DISPLAY_NAME_MIN || trimmed.length > DISPLAY_NAME_MAX) return null;

  const { data, error } = await supabase.rpc('check_display_name_available', { p_name: trimmed });
  if (error) return null;
  return Boolean(data);
}

export function isSocialAvailable(): boolean {
  return isSupabaseConfigured && isLoggedIn() && Boolean(getUserId());
}
