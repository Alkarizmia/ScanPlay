import { DEFAULT_AVATARS } from '../profile';

export function avatarEmojiFromId(avatarId: string): string {
  return DEFAULT_AVATARS.find((a) => a.id === avatarId)?.emoji ?? '🎮';
}
