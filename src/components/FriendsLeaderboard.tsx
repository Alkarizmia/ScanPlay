import { getUnlockedCount } from '../lib/achievements';

import { getGamification, getLevel } from '../lib/gamification';

import { getProfile } from '../lib/profile';

import { isUserOnline } from '../lib/social/presence';

import type { PublicPlayer } from '../lib/social/types';

import { FriendPresenceAvatar } from './FriendPresenceAvatar';

import { t } from '../lib/i18n';

import type { Locale } from '../types';



interface FriendsLeaderboardProps {

  friends: PublicPlayer[];

  locale: Locale;

  onOpenFriend: (userId: string) => void;

}



interface LeaderRow {

  userId: string;

  displayName: string;

  avatarId: string;

  avatarUrl?: string | null;

  level: number;

  xp: number;

  streak: number;

  achievementCount: number;

  isOnline: boolean;

  isMe?: boolean;

}



export function FriendsLeaderboard({ friends, locale, onOpenFriend }: FriendsLeaderboardProps) {

  const profile = getProfile();

  const { xp, streak } = getGamification();

  const me: LeaderRow = {

    userId: '__me__',

    displayName: profile?.displayName ?? t('leaderboardYou', locale),

    avatarId: profile?.avatar ?? 'avatar1',

    avatarUrl: profile?.avatar === 'custom' ? profile.customAvatarData : null,

    level: getLevel(xp),

    xp,

    streak,

    achievementCount: getUnlockedCount(),

    isOnline: true,

    isMe: true,

  };



  const rows: LeaderRow[] = [

    me,

    ...friends.map((f) => ({

      userId: f.userId,

      displayName: f.displayName,

      avatarId: f.avatarId,

      avatarUrl: f.avatarUrl,

      level: f.level,

      xp: f.xp ?? 0,

      streak: f.streak ?? 0,

      achievementCount: f.achievementCount ?? 0,

      isOnline: isUserOnline(f.lastSeenAt),

    })),

  ].sort(

    (a, b) =>

      b.xp - a.xp ||

      b.achievementCount - a.achievementCount ||

      Number(b.isOnline) - Number(a.isOnline),

  );



  return (

    <section className="settings-section friends-leaderboard-section">

      <h3 className="settings-label">{t('friendsLeaderboardTitle', locale)}</h3>

      <p className="friends-intro">{t('friendsLeaderboardHint', locale)}</p>

      <p className="friends-presence-legend">

        <span className="friend-presence-dot friend-presence-dot--online" aria-hidden="true" />

        {t('friendOnline', locale)}

        <span className="friend-presence-dot friend-presence-dot--offline" aria-hidden="true" />

        {t('friendOffline', locale)}

      </p>

      <ol className="friends-leaderboard">

        {rows.map((row, index) => (

          <li key={row.userId}>

            <button

              type="button"

              className={`friends-leaderboard-row ${row.isMe ? 'friends-leaderboard-row--me' : ''} ${!row.isMe && !row.isOnline ? 'friends-leaderboard-row--offline' : ''}`}

              onClick={() => {

                if (!row.isMe) onOpenFriend(row.userId);

              }}

              disabled={row.isMe}

            >

              <span className="friends-leaderboard-rank">#{index + 1}</span>

              <FriendPresenceAvatar

                avatarId={row.avatarId}

                avatarUrl={row.avatarUrl}

                isOnline={row.isOnline}

                locale={locale}

              />

              <span className="friends-leaderboard-name">

                {row.displayName}

                {row.isMe ? ` (${t('leaderboardYou', locale)})` : ''}

              </span>

              <span className="friends-leaderboard-stats">

                <span>{row.xp} XP</span>

                <span>{row.streak} 🔥</span>

                <span>{row.achievementCount} 🏆</span>

              </span>

            </button>

          </li>

        ))}

      </ol>

    </section>

  );

}


