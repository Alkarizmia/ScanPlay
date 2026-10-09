import { getUserId, isLoggedIn } from './auth';
import { getSupabase, isSupabaseConfigured } from './supabase';
import {
  UNIVERSE_ENGLISH_STORAGE_KEY,
  coerceUniverseEnglishProfile,
  mergeUniverseEnglishProfiles,
  replaceUniverseEnglishProfile,
  type UniverseEnglishProfile,
} from './universeEnglish';

export const UNIVERSE_ID_ENGLISH = 'english';

const PUSH_DEBOUNCE_MS = 2000;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight: Promise<void> | null = null;

function readLocalProfile(): UniverseEnglishProfile {
  try {
    const raw = localStorage.getItem(UNIVERSE_ENGLISH_STORAGE_KEY);
    if (!raw) return coerceUniverseEnglishProfile(null);
    return coerceUniverseEnglishProfile(JSON.parse(raw));
  } catch {
    return coerceUniverseEnglishProfile(null);
  }
}

/** Cancel a pending cloud push (e.g. on sign-out). */
export function cancelUniverseProgressSync(): void {
  if (pushTimer != null) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}

async function upsertEnglishProgress(profile: UniverseEnglishProfile): Promise<boolean> {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !isSupabaseConfigured || !userId || !isLoggedIn()) return false;

  const stamped: UniverseEnglishProfile = { ...profile, cloudUserId: userId };
  const updatedAt = new Date(Math.max(stamped.updatedAt || Date.now(), Date.now())).toISOString();
  try {
    const { error } = await supabase.from('universe_progress').upsert(
      {
        user_id: userId,
        universe: UNIVERSE_ID_ENGLISH,
        data: stamped,
        updated_at: updatedAt,
      },
      { onConflict: 'user_id,universe' },
    );
    if (error) {
      console.warn('[universe-sync] upsert failed', error.message);
      return false;
    }
    replaceUniverseEnglishProfile(stamped, { skipCloudPush: true });
    return true;
  } catch (e) {
    console.warn('[universe-sync] upsert error', e);
    return false;
  }
}

/** Debounced push of the current local English profile to Supabase. */
export function scheduleUniverseEnglishPush(): void {
  if (!isLoggedIn() || !isSupabaseConfigured) return;
  cancelUniverseProgressSync();
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const profile = readLocalProfile();
    if (!profile.onboarded && profile.completedLessonIds.length === 0) return;
    void upsertEnglishProgress(profile);
  }, PUSH_DEBOUNCE_MS);
}

/**
 * Immediate push (flush debounce).
 * @returns true if persisted (or nothing to save); false if offline / error.
 */
export async function flushUniverseEnglishPush(): Promise<boolean> {
  cancelUniverseProgressSync();
  if (!isLoggedIn() || !isSupabaseConfigured) return false;
  const profile = readLocalProfile();
  if (
    !profile.onboarded &&
    profile.completedLessonIds.length === 0 &&
    profile.weakWords.length === 0
  ) {
    return true;
  }
  return upsertEnglishProgress(profile);
}

/**
 * Load cloud progress for English, merge with local cache, write local, then upsert.
 * No-op when logged out or Supabase unavailable (keeps local-only UX).
 */
export async function syncUniverseEnglishFromCloud(): Promise<UniverseEnglishProfile> {
  const local = readLocalProfile();
  if (!isLoggedIn() || !isSupabaseConfigured) return local;

  if (syncInFlight) {
    await syncInFlight;
    return readLocalProfile();
  }

  syncInFlight = (async () => {
    const supabase = getSupabase();
    const userId = getUserId();
    if (!supabase || !userId) return;

    try {
      const { data: row, error } = await supabase
        .from('universe_progress')
        .select('data, updated_at')
        .eq('user_id', userId)
        .eq('universe', UNIVERSE_ID_ENGLISH)
        .maybeSingle();

      if (error) {
        console.warn('[universe-sync] fetch failed', error.message);
        return;
      }

      if (!row) {
        // First login: upload local progress if any (skip if cache belongs to another account).
        const localOk =
          !local.cloudUserId || local.cloudUserId === userId;
        if (
          localOk &&
          (local.onboarded || local.completedLessonIds.length > 0 || local.weakWords.length > 0)
        ) {
          await upsertEnglishProgress(local);
        }
        return;
      }

      const remote = coerceUniverseEnglishProfile(row.data);
      const remoteMs = Date.parse(String(row.updated_at)) || 0;
      // Never merge another account's leftover cache into this user.
      const localForMerge =
        local.cloudUserId && local.cloudUserId !== userId
          ? coerceUniverseEnglishProfile(null)
          : local;
      const merged = mergeUniverseEnglishProfiles(localForMerge, remote, remoteMs);
      replaceUniverseEnglishProfile({ ...merged, cloudUserId: userId }, { skipCloudPush: true });
      await upsertEnglishProgress({ ...merged, cloudUserId: userId });
    } catch (e) {
      console.warn('[universe-sync] sync error', e);
    }
  })();

  try {
    await syncInFlight;
  } finally {
    syncInFlight = null;
  }

  return readLocalProfile();
}
