import { loadUnlockRecords, snapshotUnlockedIds } from '../achievementUnlocks';
import { isLoggedIn } from '../auth';
import { getSupabase, isSupabaseConfigured } from '../supabase';
import { isSocialAvailable } from './publicProfile';

/** Pousse tous les succès réellement débloqués (pas seulement le journal local). */
export async function syncPublicAchievements(): Promise<void> {
  if (!isSupabaseConfigured || !isLoggedIn() || !isSocialAvailable()) return;
  const supabase = getSupabase();
  if (!supabase) return;

  const unlockedIds = snapshotUnlockedIds();
  const records = loadUnlockRecords();
  const recordMap = new Map(records.map((r) => [r.id, r.unlockedAt]));
  const now = new Date().toISOString();

  const unlocks = [...unlockedIds].map((id) => ({
    id,
    unlockedAt: recordMap.get(id) ?? now,
  }));

  await supabase.rpc('sync_public_achievement_unlocks', { p_unlocks: unlocks });
}
