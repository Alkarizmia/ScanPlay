import { t } from '../../lib/i18n';
import type { Locale } from '../../types';
import { GameProgressBar, gameProgressPct } from './GameProgressBar';

export { gameProgressPct };

interface GameHeaderProps {
  locale: Locale;
  onExit: () => void;
  progress: number;
  examMode?: boolean;
  timeLeft?: number;
}

export function GameHeader({ locale, onExit, progress, examMode, timeLeft }: GameHeaderProps) {
  return (
    <header className="game-header">
      <button type="button" className="icon-btn game-header-exit" onClick={onExit} aria-label={t('back', locale)}>
        ✕
      </button>
      <GameProgressBar value={progress} />
      {examMode && timeLeft != null ? (
        <span className="game-header-timer" aria-live="polite">
          {timeLeft}s
        </span>
      ) : (
        <span className="game-header-spacer" aria-hidden="true" />
      )}
    </header>
  );
}
