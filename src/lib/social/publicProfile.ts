import { getUserId, isLoggedIn } from '../auth';
import { getGamification } from '../gamification';
import { getHistory } from '../history';
import {
  getProfile,
  isDefaultDisplayName,
  mergeProfileFromCloud,
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
    .select('display_name, avatar_id, avatar_url, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return;

  mergeProfileFromCloud({
    displayName: data.display_name as string | null,
    avatarId: data.avatar_id as string | null,
    avatarUrl: data.avatar_url as string | null,
    updatedAt: data.updated_at as string | null,
  });
}

export async function syncPublicProfileWithDisplayName(displayName: string): Promise<SyncProfileResult> {
  if (!isSupabaseConfigured || !isLoggedIn()) return { ok: false, code: 'not_configured' };
  const supabase = getSupabase();
  const profile = getProfile();
  if (!supabase || !profile) return { ok: false, code: 'no_profile' };

  const { xp, streak } = getGamification();
  const deckCount = getHistory().length;
  const trimmed = displayName.trim().slice(0, 24);

  const { error } = await supabase.rpc('sync_public_profile_stats', {
    p_display_name: trimmed,
    p_avatar_id: profile.avatar,
    p_xp: xp,
    p_streak: streak,
    p_deck_count: deckCount,
    p_plan: getPlan(),
    p_avatar_url: profileAvatarUrl(profile),
  });

  if (error) return mapSyncError(error.message);

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
  if (!isSupabaseConfigured || !isLoggedIn()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;

  const { data, error } = await supabase.rpc('check_display_name_available', { p_name: trimmed });
  if (error) return null;
  return Boolean(data);
}

export function isSocialAvailable(): boolean {
  return isSupabaseConfigured && isLoggedIn() && Boolean(getUserId());
}
