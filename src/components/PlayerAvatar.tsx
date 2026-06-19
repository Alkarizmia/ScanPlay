import { avatarEmojiFromId } from '../lib/social/avatars';

interface PlayerAvatarProps {
  avatarId: string;
  avatarUrl?: string | null;
  className?: string;
  imgClassName?: string;
}

export function PlayerAvatar({
  avatarId,
  avatarUrl,
  className = 'friend-avatar',
  imgClassName = 'friend-avatar-img',
}: PlayerAvatarProps) {
  if (avatarUrl) {
    return (
      <span className={className} aria-hidden="true">
        <img src={avatarUrl} alt="" className={imgClassName} />
      </span>
    );
  }

  return (
    <span className={className} aria-hidden="true">
      {avatarEmojiFromId(avatarId)}
    </span>
  );
}
