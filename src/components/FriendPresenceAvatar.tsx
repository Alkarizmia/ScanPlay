import { PlayerAvatar } from './PlayerAvatar';
import { isUserOnline } from '../lib/social/presence';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface FriendPresenceAvatarProps {
  avatarId: string;
  avatarUrl?: string | null;
  isOnline: boolean;
  locale: Locale;
  className?: string;
  imgClassName?: string;
}

export function FriendPresenceAvatar({
  avatarId,
  avatarUrl,
  isOnline,
  locale,
  className = 'friend-avatar',
  imgClassName = 'friend-avatar-img',
}: FriendPresenceAvatarProps) {
  return (
    <span className="friend-avatar-wrap">
      <PlayerAvatar avatarId={avatarId} avatarUrl={avatarUrl} className={className} imgClassName={imgClassName} />
      <span
        className={`friend-presence-dot ${isOnline ? 'friend-presence-dot--online' : 'friend-presence-dot--offline'}`}
        title={isOnline ? t('friendOnline', locale) : t('friendOffline', locale)}
        aria-label={isOnline ? t('friendOnline', locale) : t('friendOffline', locale)}
      />
    </span>
  );
}

export { isUserOnline };
