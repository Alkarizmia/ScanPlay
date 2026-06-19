import { avatarEmojiFromId } from '../lib/social/avatars';
import type { RoomPlayer } from '../lib/social/types';
import { getUserId } from '../lib/auth';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface MultiplayerResultsProps {
  locale: Locale;
  deckTitle: string;
  players: RoomPlayer[];
  myScore: number;
  myTotal: number;
  onHome: () => void;
}

export function MultiplayerResults({
  locale,
  deckTitle,
  players,
  myScore,
  myTotal,
  onHome,
}: MultiplayerResultsProps) {
  const userId = getUserId();
  const ranked = [...players].sort((a, b) => {
    const pctA = a.total > 0 ? a.score / a.total : 0;
    const pctB = b.total > 0 ? b.score / b.total : 0;
    if (pctB !== pctA) return pctB - pctA;
    return b.score - a.score;
  });

  const myPct = myTotal > 0 ? Math.round((myScore / myTotal) * 100) : 0;

  return (
    <div className="screen flow-screen multiplayer-results">
      <header className="top-bar">
        <h2 className="screen-title">{t('friendsResultsTitle', locale)}</h2>
      </header>

      <main className="settings-main scroll-natural">
        <p className="friends-deck-title">{deckTitle}</p>
        <p className="friends-my-score">
          {t('friendsYourScore', locale)}: {myScore}/{myTotal} ({myPct}%)
        </p>

        <ol className="friends-ranking">
          {ranked.map((p, i) => {
            const pct = p.total > 0 ? Math.round((p.score / p.total) * 100) : 0;
            const isMe = p.userId === userId;
            return (
              <li key={p.userId} className={`friends-rank-row ${isMe ? 'friends-rank-row--me' : ''}`}>
                <span className="friends-rank-pos">#{i + 1}</span>
                <span className="friend-avatar">{avatarEmojiFromId(p.avatarId)}</span>
                <div className="friend-info">
                  <span className="friend-name">{p.displayName}</span>
                  <span className="friend-meta">
                    {p.finishedAt ? `${p.score}/${p.total} · ${pct}%` : t('friendsStillPlaying', locale)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        <button type="button" className="btn-primary btn-lg" onClick={onHome}>
          {t('backHome', locale)}
        </button>
      </main>
    </div>
  );
}
