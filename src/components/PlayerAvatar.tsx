import { avatarEmojiFromId } from '../lib/social/avatars';
import { isProfileFrameId } from '../lib/profileCosmetics';

interface PlayerAvatarProps {
  avatarId: string;
  avatarUrl?: string | null;
  avatarFrame?: string | null;
  className?: string;
  imgClassName?: string;
}

export function PlayerAvatar({
  avatarId,
  avatarUrl,
  avatarFrame,
  className = 'friend-avatar',
  imgClassName = 'friend-avatar-img',
}: PlayerAvatarProps) {
  const frameClass =
    avatarFrame && isProfileFrameId(avatarFrame) ? ` sp-profile-frame sp-profile-frame--${avatarFrame}` : '';
  const wrapClass = `${className}${frameClass}`;

  if (avatarUrl) {
    return (
      <span className={wrapClass} aria-hidden="true">
        <img src={avatarUrl} alt="" className={imgClassName} />
      </span>
    );
  }

  return (
    <span className={wrapClass} aria-hidden="true">
      {avatarEmojiFromId(avatarId)}
    </span>
  );
}
