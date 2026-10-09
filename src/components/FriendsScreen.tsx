import { useCallback, useEffect, useRef, useState } from 'react';
import { listFriends, listPendingFriendRequests, respondFriendRequest, searchPlayers, sendFriendRequest } from '../lib/social/friends';
import { isSocialAvailable, syncPublicProfile } from '../lib/social/publicProfile';
import { PlayerAvatar } from './PlayerAvatar';
import { FriendPresenceAvatar } from './FriendPresenceAvatar';
import { isUserOnline } from '../lib/social/presence';
import type { FriendStatus, PendingFriendRequest, PublicPlayer } from '../lib/social/types';
import { FriendProfileSheet } from './FriendProfileSheet';
import { FriendsLeaderboard } from './FriendsLeaderboard';
import { MedalIcon } from './icons/EconomyIcons';
import { MascotCoach } from './mascot/MascotCoach';
import { refreshFriendCount } from '../lib/social/friendCountCache';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

const SEARCH_MIN = 2;

interface FriendsScreenProps {
  locale: Locale;
  refreshKey: number;
  isLoggedIn: boolean;
  onAuth: () => void;
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
  onSocialChange,
}: FriendsScreenProps) {
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState<PublicPlayer[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingFriendRequest[]>([]);
  const [results, setResults] = useState<PublicPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [previewPlayer, setPreviewPlayer] = useState<PublicPlayer | null>(null);
  const searchTimer = useRef<number | null>(null);
  const socialOk = isSocialAvailable();

  const loadFriends = useCallback(async () => {
    if (!isLoggedIn || !socialOk) return;
    await refreshFriendCount();
    const [friendsList, pending] = await Promise.all([listFriends(), listPendingFriendRequests()]);
    setFriends(friendsList);
    setPendingRequests(pending);
  }, [isLoggedIn, socialOk]);

  const runSearch = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed.length < SEARCH_MIN) {
        setResults([]);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const found = await searchPlayers(trimmed);
      setResults(found);
      setLoading(false);
      if (found.length === 0) setError(t('friendsSearchEmpty', locale));
    },
    [locale],
  );

  const handleRespond = async (requestId: string, accept: boolean) => {
    setRespondingId(requestId);
    const ok = await respondFriendRequest(requestId, accept);
    setRespondingId(null);
    if (ok) {
      setError(null);
      onSocialChange?.();
      await loadFriends();
      if (query.trim().length >= SEARCH_MIN) await runSearch(query);
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

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (query.trim().length < SEARCH_MIN) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    searchTimer.current = window.setTimeout(() => {
      void runSearch(query);
    }, 320);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [query, runSearch]);

  const handleAdd = async (player: PublicPlayer) => {
    if (player.friendStatus === 'friends' || player.friendStatus === 'pending_sent') return;
    if (player.friendStatus === 'pending_received') return;
    const ok = await sendFriendRequest(player.userId);
    if (ok) {
      setError(null);
      setPreviewPlayer((cur) => (cur ? { ...cur, friendStatus: 'pending_sent' } : cur));
      if (query.trim().length >= SEARCH_MIN) await runSearch(query);
    } else {
      setError(t('friendsRequestError', locale));
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setError(null);
    setLoading(false);
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
        <button type="button" className="friend-row-main" onClick={() => setPreviewPlayer(player)}>
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
        </button>
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
              <>
                {' '}
                · {player.achievementCount} <MedalIcon size={14} tier="gold" />
              </>
            )}
          </span>
        </div>
        <span className="friend-chevron" aria-hidden="true">
          ›
        </span>
      </button>
    </li>
  );

  const searching = query.trim().length >= SEARCH_MIN;

  return (
    <div className="screen tab-screen friends-screen">
      <header className="top-bar">
        <h2 className="screen-title">{t('friendsTitle', locale)}</h2>
      </header>

      <main className="settings-main scroll-natural friends-main">
        <div className="friends-search-bar" role="search">
          <span className="friends-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            className="friends-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('friendsSearchPlaceholder', locale)}
            maxLength={24}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-label={t('friendsSearchTitle', locale)}
          />
          {query.length > 0 && (
            <button
              type="button"
              className="friends-search-clear"
              onClick={clearSearch}
              aria-label={t('friendsSearchClear', locale)}
            >
              ✕
            </button>
          )}
        </div>

        {searching && (
          <section className="settings-section friends-search-results" aria-live="polite">
            {loading && <p className="friends-search-status">{t('friendsSearchLoading', locale)}</p>}
            {error && !loading && <p className="friends-error">{error}</p>}
            {!loading && results.length > 0 && <ul className="friend-list">{results.map(renderSearchRow)}</ul>}
          </section>
        )}

        {pendingRequests.length > 0 && (
          <section className="settings-section">
            <h3 className="settings-label">{t('friendsRequestsTitle', locale)}</h3>
            <ul className="friend-requests-list">{pendingRequests.map(renderPendingRequest)}</ul>
          </section>
        )}

        <section className="settings-section">
          <h3 className="settings-label">{t('friendsListTitle', locale)}</h3>
          {friends.length === 0 ? (
            <div className="friends-empty-state">
              <MascotCoach
                expression="welcome"
                size={88}
                placement="card"
                idle
                message={t('friendsListEmpty', locale)}
              />
            </div>
          ) : (
            <>
              <FriendsLeaderboard friends={friends} locale={locale} onOpenFriend={setSelectedFriendId} />
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
      <FriendProfileSheet
        open={previewPlayer !== null}
        userId={previewPlayer?.userId ?? null}
        locale={locale}
        preview
        friendStatus={previewPlayer?.friendStatus ?? 'none'}
        seed={previewPlayer}
        onClose={() => setPreviewPlayer(null)}
        onAdd={() => {
          if (previewPlayer) void handleAdd(previewPlayer);
        }}
      />
    </div>
  );
}
