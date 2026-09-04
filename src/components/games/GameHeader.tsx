import { useEffect, useRef, useState } from 'react';
import { useGameHud } from '../../hooks/useGameHud';
import { getGamification } from '../../lib/gamification';
import { t } from '../../lib/i18n';
import type { Locale } from '../../types';
import { StreakFlame } from '../icons/StreakFlame';
import { GameProgressBar, gameProgressPct } from './GameProgressBar';

export { gameProgressPct };

interface GameHeaderProps {
  locale: Locale;
  onExit: () => void;
  progress: number;
  examMode?: boolean;
  timeLeft?: number;
  /** Hide streak / XP chips when the surrounding screen already shows them. */
  hud?: boolean;
}

/** Flashes the XP chip each time the running total grows. */
function useXpPulse(xp: number): boolean {
  const previous = useRef(xp);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (xp > previous.current) {
      setPulsing(true);
      const timer = window.setTimeout(() => setPulsing(false), 620);
      previous.current = xp;
      return () => window.clearTimeout(timer);
    }
    previous.current = xp;
  }, [xp]);

  return pulsing;
}

export function GameHeader({
  locale,
  onExit,
  progress,
  examMode,
  timeLeft,
  hud = true,
}: GameHeaderProps) {
  const { xp, combo } = useGameHud();
  const xpPulse = useXpPulse(xp);
  const { streak } = getGamification();
  const showStreak = hud && streak > 0;
  const showXp = hud && xp > 0;
  const showCombo = hud && combo >= 3;

  return (
    <header className="game-header game-header--hud">
      <div className="game-header-top">
        <button
          type="button"
          className="icon-btn game-header-exit"
          onClick={onExit}
          aria-label={t('back', locale)}
        >
          ✕
        </button>

        <div className="game-hud" aria-live="polite">
          {showCombo && (
            <span className="game-hud-chip game-hud-chip--combo" key={`combo-${combo}`}>
              ×{combo}
            </span>
          )}
          {showStreak && (
            <span className="game-hud-chip game-hud-chip--streak" title={t('streak', locale)}>
              <StreakFlame lit={streak > 0} size={14} /> {streak}
            </span>
          )}
          {showXp && (
            <span
              className={`game-hud-chip game-hud-chip--xp${xpPulse ? ' is-pulsing' : ''}`}
              title={t('resultXpGain', locale)}
            >
              +{xp} XP
            </span>
          )}
          {examMode && timeLeft != null && (
            <span className="game-hud-chip game-hud-chip--timer game-header-timer">
              {timeLeft}s
            </span>
          )}
        </div>
      </div>

      <div className="game-header-progress">
        <GameProgressBar value={progress} />
      </div>
    </header>
  );
}
