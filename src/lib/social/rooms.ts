import { getUserId } from '../auth';
import { getProfile } from '../profile';
import { getSupabase } from '../supabase';
import { encodeRoomSeed, parseRoomSeed } from '../roomSeed';
import type { WordPair } from '../../types';
import { syncPublicProfile, isSocialAvailable } from './publicProfile';
import type { MultiplayerRoom, RoomPlayer, RoomStatus } from './types';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function randomSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapRoom(row: Record<string, unknown>): MultiplayerRoom {
  const seed = String(row.seed);
  const { quizSeed, pathStepCount } = parseRoomSeed(seed);
  return {
    id: String(row.id),
    hostId: String(row.host_id),
    inviteCode: String(row.invite_code),
    deckTitle: String(row.deck_title),
    pairs: (row.pairs as WordPair[]) ?? [],
    mode: 'quiz',
    status: String(row.status) as RoomStatus,
    seed,
    quizSeed,
    pathStepCount,
    maxPlayers: Number(row.max_players ?? 4),
    createdAt: String(row.created_at),
  };
}

function mapPlayer(row: Record<string, unknown>): RoomPlayer {
  return {
    userId: String(row.user_id),
    displayName: String(row.display_name),
    avatarId: String(row.avatar_id ?? 'avatar1'),
    score: Number(row.score ?? 0),
    total: Number(row.total ?? 0),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    joinedAt: String(row.joined_at),
  };
}

export async function fetchRoomState(roomId: string): Promise<{
  room: MultiplayerRoom | null;
  players: RoomPlayer[];
}> {
  const supabase = getSupabase();
  if (!supabase) return { room: null, players: [] };

  const [{ data: roomRow }, { data: players }] = await Promise.all([
    supabase.from('scanplay_rooms').select('*').eq('id', roomId).maybeSingle(),
    supabase.from('scanplay_room_players').select('*').eq('room_id', roomId).order('joined_at'),
  ]);

  return {
    room: roomRow ? mapRoom(roomRow as Record<string, unknown>) : null,
    players: (players ?? []).map((p) => mapPlayer(p as Record<string, unknown>)),
  };
}

function mapRoomFromJson(data: Record<string, unknown>): MultiplayerRoom {
  return mapRoom({
    id: data.id,
    host_id: data.host_id,
    invite_code: data.invite_code,
    deck_title: data.deck_title,
    pairs: data.pairs,
    mode: data.mode ?? 'quiz',
    status: data.status ?? 'waiting',
    seed: data.seed,
    max_players: data.max_players ?? 4,
    created_at: data.created_at ?? new Date().toISOString(),
  });
}

export async function createRoom(
  deckTitle: string,
  pairs: WordPair[],
  options?: { pathStepCount?: number },
): Promise<MultiplayerRoom | null> {
  if (!isSocialAvailable()) return null;
  const supabase = getSupabase();
  const userId = getUserId();
  const profile = getProfile();
  if (!supabase || !userId || !profile) return null;

  await syncPublicProfile();

  const quizSeed = randomSeed();
  const pathStepCount = options?.pathStepCount ?? 10;
  const seed = encodeRoomSeed(quizSeed, pathStepCount);

  const { data, error } = await supabase.rpc('create_path_room', {
    p_deck_title: deckTitle.slice(0, 60),
    p_pairs: pairs,
    p_seed: seed,
  });

  if (!error && data && typeof data === 'object') {
    return mapRoomFromJson(data as Record<string, unknown>);
  }

  // Fallback direct insert (anciennes installs)
  let inviteCode = randomInviteCode();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: row, error: insertError } = await supabase
      .from('scanplay_rooms')
      .insert({
        host_id: userId,
        invite_code: inviteCode,
        deck_title: deckTitle.slice(0, 60),
        pairs,
        seed,
        status: 'waiting',
      })
      .select('*')
      .single();

    if (!insertError && row) {
      const room = mapRoom(row as Record<string, unknown>);
      await supabase.from('scanplay_room_players').insert({
        room_id: room.id,
        user_id: userId,
        display_name: profile.displayName,
        avatar_id: profile.avatar,
      });
      return room;
    }
    if (insertError?.code === '23505') {
      inviteCode = randomInviteCode();
      continue;
    }
    break;
  }

  return null;
}

export async function joinRoomByCode(code: string): Promise<MultiplayerRoom | null> {
  if (!isSocialAvailable()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  await syncPublicProfile();

  const { data, error } = await supabase.rpc('join_room_by_code', { p_code: code.trim() });
  if (error || !data || typeof data !== 'object') return null;

  const payload = data as Record<string, unknown>;
  const roomId = String(payload.room_id ?? payload.id ?? '');
  if (roomId) {
    const { room } = await fetchRoomState(roomId);
    if (room) return room;
  }

  if (payload.invite_code && payload.pairs) {
    return mapRoomFromJson({
      id: payload.room_id ?? payload.id,
      host_id: payload.host_id,
      invite_code: payload.invite_code,
      deck_title: payload.deck_title,
      pairs: payload.pairs,
      status: payload.status ?? 'waiting',
      seed: payload.seed,
      max_players: 4,
      created_at: new Date().toISOString(),
    });
  }

  return null;
}

export async function startRoom(roomId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase.rpc('start_room', { p_room_id: roomId });
  return !error;
}

export async function submitRoomScore(roomId: string, score: number, total: number): Promise<boolean> {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return false;

  const { error } = await supabase
    .from('scanplay_room_players')
    .update({
      score,
      total,
      finished_at: new Date().toISOString(),
    })
    .eq('room_id', roomId)
    .eq('user_id', userId);

  if (error) return false;

  await supabase.rpc('finish_room_if_complete', { p_room_id: roomId });
  return true;
}

export function subscribeRoom(
  roomId: string,
  onUpdate: () => void,
): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'scanplay_room_players', filter: `room_id=eq.${roomId}` },
      () => onUpdate(),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'scanplay_rooms', filter: `id=eq.${roomId}` },
      () => onUpdate(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function isRoomHost(room: MultiplayerRoom): boolean {
  return room.hostId === getUserId();
}
