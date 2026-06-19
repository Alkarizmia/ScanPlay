import { useCallback, useEffect, useState } from 'react';
import {
  fetchRoomState,
  isRoomHost,
  startRoom,
  subscribeRoom,
} from '../lib/social/rooms';
import { avatarEmojiFromId } from '../lib/social/avatars';
import type { MultiplayerRoom, RoomPlayer } from '../lib/social/types';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface MultiplayerLobbyProps {
  locale: Locale;
  roomId: string;
  onBack: () => void;
  onStart: (room: MultiplayerRoom, players: RoomPlayer[]) => void;
  onError: (message: string) => void;
}

export function MultiplayerLobby({
  locale,
  roomId,
  onBack,
  onStart,
  onError,
}: MultiplayerLobbyProps) {
  const [room, setRoom] = useState<MultiplayerRoom | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(async () => {
    const state = await fetchRoomState(roomId);
    if (!state.room) {
      onError(t('friendsRoomNotFound', locale));
      onBack();
      return;
    }
    setRoom(state.room);
    setPlayers(state.players);
    if (state.room.status === 'playing') {
      onStart(state.room, state.players);
    }
  }, [roomId, locale, onBack, onError, onStart]);

  useEffect(() => {
    void refresh();
    return subscribeRoom(roomId, () => {
      void refresh();
    });
  }, [roomId, refresh]);

  const handleStart = async () => {
    if (!room || !isRoomHost(room)) return;
    setStarting(true);
    const ok = await startRoom(room.id);
    setStarting(false);
    if (!ok) {
      onError(t('friendsStartError', locale));
      return;
    }
    await refresh();
  };

  const copyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.inviteCode);
    } catch {
      /* ignore */
    }
  };

  if (!room) {
    return (
      <div className="screen flow-screen">
        <header className="top-bar">
          <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back', locale)}>
            ←
          </button>
          <h2 className="screen-title">{t('friendsLobbyTitle', locale)}</h2>
        </header>
        <p className="friends-loading">{t('scanning', locale)}</p>
      </div>
    );
  }

  const isHost = isRoomHost(room);

  return (
    <div className="screen flow-screen multiplayer-lobby">
      <header className="top-bar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back', locale)}>
          ←
        </button>
        <h2 className="screen-title">{t('friendsLobbyTitle', locale)}</h2>
      </header>

      <main className="settings-main scroll-natural">
        <section className="settings-section">
          <p className="friends-deck-title">{room.deckTitle}</p>
          <div className="friends-code-card">
            <span className="friends-code-label">{t('friendsInviteCode', locale)}</span>
            <span className="friends-code-value">{room.inviteCode}</span>
            <button type="button" className="btn-secondary btn-sm" onClick={() => void copyCode()}>
              {t('friendsCopyCode', locale)}
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h3 className="settings-label">
            {t('friendsPlayers', locale)} ({players.length}/{room.maxPlayers})
          </h3>
          <ul className="friend-list">
            {players.map((p) => (
              <li key={p.userId} className="friend-row">
                <span className="friend-avatar">{avatarEmojiFromId(p.avatarId)}</span>
                <div className="friend-info">
                  <span className="friend-name">{p.displayName}</span>
                  {p.userId === room.hostId && (
                    <span className="friend-host-tag">{t('friendsHost', locale)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {isHost ? (
          <button
            type="button"
            className="btn-primary btn-lg"
            disabled={starting || players.length < 2}
            onClick={() => void handleStart()}
          >
            {t('friendsStartGame', locale)}
          </button>
        ) : (
          <p className="friends-wait-host">{t('friendsWaitHost', locale)}</p>
        )}
      </main>
    </div>
  );
}
