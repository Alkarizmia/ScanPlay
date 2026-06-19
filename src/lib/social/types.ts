import type { AchievementId } from '../achievements';
import type { Plan, WordPair } from '../../types';

export type FriendStatus = 'none' | 'friends' | 'pending_sent' | 'pending_received';

export interface PublicUnlockRecord {
  id: AchievementId;
  unlockedAt: string;
}

export interface PendingFriendRequest {
  requestId: string;
  fromUserId: string;
  displayName: string;
  avatarId: string;
  avatarUrl?: string | null;
  level: number;
  createdAt: string;
}

export interface PublicPlayer {
  userId: string;
  displayName: string;
  avatarId: string;
  avatarUrl?: string | null;
  level: number;
  xp?: number;
  streak?: number;
  deckCount?: number;
  achievementCount?: number;
  friendStatus?: FriendStatus;
  friendsSince?: string;
  lastSeenAt?: string | null;
}

export interface FriendProfile {
  userId: string;
  displayName: string;
  avatarId: string;
  avatarUrl?: string | null;
  level: number;
  xp: number;
  streak: number;
  deckCount: number;
  plan: Plan;
  friendCount: number;
  achievementCount: number;
  achievementUnlocks: PublicUnlockRecord[];
}

export interface SocialNotification {
  id: string;
  kind: 'friend_request' | 'friend_accepted';
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface MultiplayerRoom {
  id: string;
  hostId: string;
  inviteCode: string;
  deckTitle: string;
  pairs: WordPair[];
  mode: 'quiz';
  status: RoomStatus;
  seed: string;
  quizSeed: string;
  pathStepCount: number;
  maxPlayers: number;
  createdAt: string;
}

export interface RoomPlayer {
  userId: string;
  displayName: string;
  avatarId: string;
  score: number;
  total: number;
  finishedAt: string | null;
  joinedAt: string;
}

export interface ActiveMultiplayerSession {
  room: MultiplayerRoom;
  players: RoomPlayer[];
  isHost: boolean;
}
