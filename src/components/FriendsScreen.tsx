import { useCallback, useEffect, useState } from 'react';
import { listFriends, listPendingFriendRequests, respondFriendRequest, searchPlayers, sendFriendRequest } from '../lib/social/friends';
import { isSocialAvailable, syncPublicProfile } from '../lib/social/publicProfile';
import { PlayerAvatar } from './PlayerAvatar';
import { FriendPresenceAvatar } from './FriendPresenceAvatar';
import { isUserOnline } from '../lib/social/presence';
import type { FriendStatus, PendingFriendRequest, PublicPlayer } from '../lib/social/types';
import { FriendProfileSheet } from './FriendProfileSheet';
import { FriendsLeaderboard } from './FriendsLeaderboard';
import { refreshFriendCount } from '../lib/social/friendCountCache';
import { hasFeature } from '../lib/planLimits';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface FriendsScreenProps {
  locale: Locale;
  refreshKey: number;
  isLoggedIn: boolean;
  onAuth: () => void;
  onUpgrade: () => void;
  onStartScanForGame: () => void;
  onJoinRoom: (code: string) => void;
  onSocialChange?: () => void;
}

function statusLabel(status: FriendStatus | undefined, locale: Locale): string {
  switch (status) {
    case 'friends':
      return t('friendsStatusFriends', locale);
    case 'pending_sent':
      return t('friendsStatusPendingSent', locale);
    case 'pending_received':
      return t('friendsStatusPendingReceived', locale);
    default:
      return t('friendsAdd', locale);
  }
}

export function FriendsScreen({
  locale,
  refreshKey,
  isLoggedIn,
  onAuth,
  onUpgrade,
  onStartScanForGame,
  onJoinRoom,
  onSocialChange,
}: FriendsScreenProps) {
  const [query, setQuery] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [friends, setFriends] = useState<PublicPlayer[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingFriendRequest[]>([]);
  const [results, setResults] = useState<PublicPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const socialOk = isSocialAvailable();
  const canMulti = hasFeature('multiplayer');

  const loadFriends = useCallback(async () => {
    if (!isLoggedIn || !socialOk) return;
    await refreshFriendCount();
    const [friendsList, pending] = await Promise.all([listFriends(), listPendingFriendRequests()]);
    setFriends(friendsList);
    setPendingRequests(pending);
  }, [isLoggedIn, socialOk]);

  const handleRespond = async (requestId: string, accept: boolean) => {
    setRespondingId(requestId);
    const ok = await respondFriendRequest(requestId, accept);
    setRespondingId(null);
    if (ok) {
      setError(null);
      onSocialChange?.();
      await loadFriends();
      if (query.trim().length >= 2) await runSearch();
    } else {
      setError(t('friendsRequestError', locale));
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !socialOk) return;
    void syncPublicProfile();
    void loadFriends();
    const refreshId = window.setInterval(() => void loadFriends(), 60_000);
    return () => {
      window.clearInterval(refreshId);
    };
  }, [loadFriends, refreshKey, isLoggedIn, socialOk]);

  const runSearch = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    const found = await searchPlayers(query);
    setResults(found);
    setLoading(false);
    if (found.length === 0) setError(t('friendsSearchEmpty', locale));
  };

  const handleAdd = async (player: PublicPlayer) => {
    if (player.friendStatus === 'friends' || player.friendStatus === 'pending_sent') return;
    if (player.friendStatus === 'pending_received') return;
    const ok = await sendFriendRequest(player.userId);
    if (ok) {
      setError(null);
      if (query.trim().length >= 2) await runSearch();
    } else {
      setError(t('friendsRequestError', locale));
    }
  };

  const handleCreateRoom = () => {
    if (!canMulti) {
      onUpgrade();
      return;
    }
    onStartScanForGame();
  };

  const handleJoin = () => {
    if (!canMulti) {
      onUpgrade();
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (code.length < 6) return;
    onJoinRoom(code);
  };

  if (!isLoggedIn) {
    return (
      <div className="screen tab-screen">
        <header className="top-bar">
          <h2 className="screen-title">{t('friendsTitle', locale)}</h2>
        </header>
        <main className="settings-main scroll-natural">
          <section className="settings-section">
            <p className="stats-login-hint">{t('friendsLoginHint', locale)}</p>
            <button type="button" className="btn-primary" onClick={onAuth}>
              {t('connect', locale)}
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (!socialOk) {
    return (
      <div className="screen tab-screen">
        <header className="top-bar">
          <h2 className="screen-title">{t('friendsTitle', locale)}</h2>
        </header>
        <main className="settings-main scroll-natural">
          <p className="stats-login-hint">{t('friendsSupabaseHint', locale)}</p>
        </main>
      </div>
    );
  }

  const renderSearchRow = (player: PublicPlayer) => {
    const status = player.friendStatus ?? 'none';
    const pending = pendingRequests.find((r) => r.fromUserId === player.userId);
    const disabled = status === 'friends' || status === 'pending_sent' || (status === 'pending_received' && !pending);

    return (
      <li key={player.userId} className="friend-row">
        <FriendPresenceAvatar
          avatarId={player.avatarId}
          avatarUrl={player.avatarUrl}
          isOnline={isUserOnline(player.lastSeenAt)}
          locale={locale}
        />
        <div className="friend-info">
          <span className="friend-name">{player.displayName}</span>
          <span className="friend-meta">
            {t('level', locale)} {player.level}
          </span>
        </div>
        {status === 'pending_received' && pending ? (
          <div className="friend-request-actions friend-request-actions--inline">
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={respondingId === pending.requestId}
              onClick={() => void handleRespond(pending.requestId, true)}
            >
              {t('friendsAccept', locale)}
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={respondingId === pending.requestId}
              onClick={() => void handleRespond(pending.requestId, false)}
            >
              {t('friendsReject', locale)}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={`btn-secondary btn-sm friend-follow-btn ${disabled ? 'friend-follow-btn--active' : ''}`}
            disabled={disabled}
            onClick={() => void handleAdd(player)}
          >
            {statusLabel(status, locale)}
          </button>
        )}
      </li>
    );
  };

  const renderPendingRequest = (request: PendingFriendRequest) => (
    <li key={request.requestId} className="friend-request-card">
      <div className="friend-request-card-main">
        <PlayerAvatar avatarId={request.avatarId} avatarUrl={request.avatarUrl} />
        <div className="friend-info">
          <span className="friend-name">{request.displayName}</span>
          <span className="friend-meta">
            {t('notifFriendRequestBody', locale).replace('{name}', request.displayName)}
          </span>
        </div>
      </div>
      <div className="friend-request-actions">
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={respondingId === request.requestId}
          onClick={() => void handleRespond(request.requestId, true)}
        >
          {t('friendsAccept', locale)}
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={respondingId === request.requestId}
          onClick={() => void handleRespond(request.requestId, false)}
        >
          {t('friendsReject', locale)}
        </button>
      </div>
    </li>
  );

  const renderFriendRow = (player: PublicPlayer) => (
    <li key={player.userId}>
      <button
        type="button"
        className="friend-row friend-row--clickable"
        onClick={() => setSelectedFriendId(player.userId)}
      >
        <FriendPresenceAvatar
          avatarId={player.avatarId}
          avatarUrl={player.avatarUrl}
          isOnline={isUserOnline(player.lastSeenAt)}
          locale={locale}
        />
        <div className="friend-info">
          <span className="friend-name">{player.displayName}</span>
          <span className="friend-meta">
            {t('level', locale)} {player.level}
            {(player.achievementCount ?? 0) > 0 && (
              <> · {player.achievementCount} 🏆</>
            )}
          </span>
        </div>
        <span className="friend-chevron" aria-hidden="true">
          ›
        </span>
      </button>
    </li>
  );

  return (
    <div className="screen tab-screen friends-screen">
      <header className="top-bar">
        <h2 className="screen-title">{t('friendsTitle', locale)}</h2>
      </header>

      <main className="settings-main scroll-natural">
        <section className="settings-section">
          <h3 className="settings-label">{t('friendsMultiTitle', locale)}</h3>
          <p className="friends-intro">{t('friendsMultiHint', locale)}</p>
          <p className="friends-intro friends-intro--sub">{t('friendsMultiScanHint', locale)}</p>
          <button type="button" className="btn-primary btn-lg" onClick={handleCreateRoom}>
            {t('friendsCreateRoom', locale)}
          </button>
          <div className="friends-join-row">
            <input
              className="profile-name-input friends-code-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder={t('friendsCodePlaceholder', locale)}
              maxLength={6}
            />
            <button type="button" className="btn-secondary" onClick={handleJoin}>
              {t('friendsJoinRoom', locale)}
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h3 className="settings-label">{t('friendsSearchTitle', locale)}</h3>
          <div className="friends-search-row">
            <input
              className="profile-name-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('friendsSearchPlaceholder', locale)}
              maxLength={24}
            />
            <button type="button" className="btn-secondary" onClick={() => void runSearch()} disabled={loading}>
              {t('friendsSearchBtn', locale)}
            </button>
          </div>
          {error && <p className="friends-error">{error}</p>}
          {results.length > 0 && <ul className="friend-list">{results.map(renderSearchRow)}</ul>}
        </section>

        {pendingRequests.length > 0 && (
          <section className="settings-section">
            <h3 className="settings-label">{t('friendsRequestsTitle', locale)}</h3>
            <ul className="friend-requests-list">{pendingRequests.map(renderPendingRequest)}</ul>
          </section>
        )}

        <section className="settings-section">
          <h3 className="settings-label">{t('friendsListTitle', locale)}</h3>
          {friends.length === 0 ? (
            <p className="friends-empty">{t('friendsListEmpty', locale)}</p>
          ) : (
            <>
              <FriendsLeaderboard
                friends={friends}
                locale={locale}
                onOpenFriend={setSelectedFriendId}
              />
              <ul className="friend-list">{friends.map(renderFriendRow)}</ul>
            </>
          )}
        </section>
      </main>

      <FriendProfileSheet
        open={selectedFriendId !== null}
        userId={selectedFriendId}
        locale={locale}
        onClose={() => setSelectedFriendId(null)}
        onRemoved={() => void loadFriends()}
        onWalletChange={() => onSocialChange?.()}
      />
    </div>
  );
}
