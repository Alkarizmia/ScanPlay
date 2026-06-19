import { getUserId } from '../auth';
import { getGamification } from '../gamification';
import { getHistory } from '../history';
import { getProfile } from '../profile';
import { getPlan } from '../planLimits';
import { getSupabase } from '../supabase';
import { syncPublicProfile, isSocialAvailable } from './publicProfile';
import type { AchievementId } from '../achievements';
import type { FriendProfile, FriendStatus, PendingFriendRequest, PublicPlayer, PublicUnlockRecord, SocialNotification } from './types';
import type { Plan } from '../../types';

function mapPlan(raw: unknown): Plan {
  if (raw === 'plus' || raw === 'pro') return raw;
  return 'free';
}

function mapFriendStatus(raw: unknown): FriendStatus {
  if (raw === 'friends' || raw === 'pending_sent' || raw === 'pending_received') return raw;
  return 'none';
}

function mapPlayer(row: Record<string, unknown>): PublicPlayer {
  return {
    userId: String(row.user_id),
    displayName: String(row.display_name),
    avatarId: String(row.avatar_id ?? 'avatar1'),
    avatarUrl: row.avatar_url != null ? String(row.avatar_url) : null,
    level: Number(row.level ?? 1),
    xp: row.xp != null ? Number(row.xp) : undefined,
    streak: row.streak != null ? Number(row.streak) : undefined,
    deckCount: row.deck_count != null ? Number(row.deck_count) : undefined,
    achievementCount: row.achievement_count != null ? Number(row.achievement_count) : undefined,
    friendStatus: mapFriendStatus(row.friend_status),
    friendsSince: row.friends_since ? String(row.friends_since) : undefined,
    lastSeenAt: row.last_seen_at != null ? String(row.last_seen_at) : null,
  };
}

function mapAchievementUnlocks(raw: unknown): PublicUnlockRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicUnlockRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? '') as AchievementId;
    const unlockedAt = String(row.unlockedAt ?? row.unlocked_at ?? '');
    if (!id || !unlockedAt) continue;
    out.push({ id, unlockedAt });
  }
  return out;
}

async function syncStatsToCloud(): Promise<void> {
  if (!isSocialAvailable()) return;
  const supabase = getSupabase();
  const profile = getProfile();
  if (!supabase || !profile) return;

  const { xp, streak } = getGamification();
  const deckCount = getHistory().length;

  await supabase.rpc('sync_public_profile_stats', {
    p_display_name: profile.displayName,
    p_avatar_id: profile.avatar,
    p_xp: xp,
    p_streak: streak,
    p_deck_count: deckCount,
    p_plan: getPlan(),
    p_avatar_url:
      profile.avatar === 'custom' && profile.customAvatarData ? profile.customAvatarData : null,
  });
}

export async function searchPlayers(query: string): Promise<PublicPlayer[]> {
  if (!isSocialAvailable()) return [];
  const supabase = getSupabase();
  if (!supabase) return [];

  await syncPublicProfile();

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await supabase.rpc('search_players', { p_query: trimmed });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => mapPlayer(row as Record<string, unknown>));
}

export async function listFriends(): Promise<PublicPlayer[]> {
  if (!isSocialAvailable()) return [];
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('list_my_friends');
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => ({
    ...mapPlayer(row as Record<string, unknown>),
    friendStatus: 'friends' as const,
  }));
}

export async function countFriends(): Promise<number> {
  if (!isSocialAvailable()) return 0;
  const supabase = getSupabase();
  if (!supabase) return 0;

  const { data, error } = await supabase.rpc('count_my_friends');
  if (error || data == null) return 0;
  const count = Number(data);
  void import('./friendCountCache').then((m) => m.setCachedFriendCount(count));
  return count;
}

export async function listPendingFriendRequests(): Promise<PendingFriendRequest[]> {
  if (!isSocialAvailable()) return [];
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('list_pending_friend_requests');
  if (error || !Array.isArray(data)) return [];

  return data.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      requestId: String(r.request_id),
      fromUserId: String(r.from_user_id),
      displayName: String(r.display_name ?? 'Joueur'),
      avatarId: String(r.avatar_id ?? 'avatar1'),
      avatarUrl: r.avatar_url != null ? String(r.avatar_url) : null,
      level: Number(r.level ?? 1),
      createdAt: String(r.created_at ?? new Date().toISOString()),
    };
  });
}

export async function getFriendProfile(userId: string): Promise<FriendProfile | null> {
  if (!isSocialAvailable()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('get_friend_profile', { p_user_id: userId });
  if (error || !data || typeof data !== 'object') return null;

  const row = data as Record<string, unknown>;
  return {
    userId: String(row.user_id),
    displayName: String(row.display_name),
    avatarId: String(row.avatar_id ?? 'avatar1'),
    avatarUrl: row.avatar_url != null ? String(row.avatar_url) : null,
    level: Number(row.level ?? 1),
    xp: Number(row.xp ?? 0),
    streak: Number(row.streak ?? 0),
    deckCount: Number(row.deck_count ?? 0),
    plan: mapPlan(row.plan),
    friendCount: Number(row.friend_count ?? 0),
    achievementCount: Number(row.achievement_count ?? mapAchievementUnlocks(row.achievement_unlocks).length),
    achievementUnlocks: mapAchievementUnlocks(row.achievement_unlocks),
  };
}

export async function sendFriendRequest(targetId: string): Promise<boolean> {
  if (!isSocialAvailable()) return false;
  const supabase = getSupabase();
  if (!supabase) return false;

  await syncStatsToCloud();
  const { error } = await supabase.rpc('send_friend_request', { p_target: targetId });
  return !error;
}

export async function respondFriendRequest(requestId: string, accept: boolean): Promise<boolean> {
  if (!isSocialAvailable()) return false;
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase.rpc('respond_friend_request', {
    p_request_id: requestId,
    p_accept: accept,
  });
  return !error;
}

export async function removeFriend(targetId: string): Promise<boolean> {
  if (!isSocialAvailable()) return false;
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase.rpc('remove_friend', { p_target: targetId });
  return !error;
}

export async function listSocialNotifications(limit = 20): Promise<SocialNotification[]> {
  if (!isSocialAvailable()) return [];
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('list_social_notifications', { p_limit: limit });
  if (error || !Array.isArray(data)) return [];

  return data.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      kind: r.kind as SocialNotification['kind'],
      payload: (r.payload as Record<string, unknown>) ?? {},
      readAt: r.read_at ? String(r.read_at) : null,
      createdAt: String(r.created_at),
    };
  });
}

export async function countUnreadSocialNotifications(): Promise<number> {
  if (!isSocialAvailable()) return 0;
  const supabase = getSupabase();
  if (!supabase) return 0;

  const { data, error } = await supabase.rpc('count_unread_social_notifications');
  if (error || data == null) return 0;
  return Number(data);
}

export async function markSocialNotificationRead(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.rpc('mark_social_notification_read', { p_id: id });
}

export { syncStatsToCloud };

/** @deprecated use sendFriendRequest */
export async function followUser(targetId: string): Promise<boolean> {
  return sendFriendRequest(targetId);
}

/** @deprecated use removeFriend */
export async function unfollowUser(targetId: string): Promise<boolean> {
  return removeFriend(targetId);
}

export function isMe(userId: string): boolean {
  return getUserId() === userId;
}
