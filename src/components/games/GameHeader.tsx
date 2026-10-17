import { useEffect, useRef, useState } from 'react';
import { useGameHud } from '../../hooks/useGameHud';
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
  /** Hide streak / XP chips when the surrounding screen already shows them. */
  hud?: boolean;
}

type XpFloat = { id: number; delta: number };

/** Pulse + floating delta when the running XP total changes. */
function useXpFx(xp: number): { pulsing: boolean; lossPulse: boolean; float: XpFloat | null } {
  const previous = useRef(xp);
  const [pulsing, setPulsing] = useState(false);
  const [lossPulse, setLossPulse] = useState(false);
  const [float, setFloat] = useState<XpFloat | null>(null);

  useEffect(() => {
    if (xp === previous.current) return;
    const delta = xp - previous.current;
    previous.current = xp;
    if (delta === 0) return;

    setFloat({ id: Date.now(), delta });
    if (delta > 0) {
      setPulsing(true);
      setLossPulse(false);
      const timer = window.setTimeout(() => setPulsing(false), 620);
      return () => window.clearTimeout(timer);
    }
    setLossPulse(true);
    setPulsing(false);
    const timer = window.setTimeout(() => setLossPulse(false), 700);
    return () => window.clearTimeout(timer);
  }, [xp]);

  useEffect(() => {
    if (!float) return;
    const timer = window.setTimeout(() => setFloat(null), 900);
    return () => window.clearTimeout(timer);
  }, [float]);

  return { pulsing, lossPulse, float };
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
  const { pulsing, lossPulse, float } = useXpFx(xp);
  const showXp = hud && xp !== 0;
  const showCombo = hud && combo >= 2;
  const showHud = showXp || showCombo || (examMode && timeLeft != null) || float != null;

  return (
    <header className="game-header">
      <button
        type="button"
        className="icon-btn game-header-exit"
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onExit();
        }}
        aria-label={t('back', locale)}
      >
        ✕
      </button>

      <GameProgressBar value={progress} />

      {showHud ? (
        <div className="game-hud" aria-live="polite">
          {showCombo && (
            <span className="game-hud-chip game-hud-chip--combo" key={`combo-${combo}`}>
              ×{combo}
            </span>
          )}
          <div className="game-hud-xp-wrap">
            {float && (
              <span
                key={float.id}
                className={`game-hud-xp-float${float.delta < 0 ? ' game-hud-xp-float--loss' : ''}`}
                aria-hidden="true"
              >
                {float.delta > 0 ? '+' : ''}
                {float.delta}
              </span>
            )}
            {(showXp || float) && (
              <span
                className={`game-hud-chip game-hud-chip--xp${xp < 0 ? ' game-hud-chip--xp-loss' : ''}${
                  pulsing ? ' is-pulsing' : ''
                }${lossPulse ? ' is-losing' : ''}`}
                title={t('resultXpGain', locale)}
              >
                {xp > 0 ? '+' : ''}
                {xp} XP
              </span>
            )}
          </div>
          {examMode && timeLeft != null && (
            <span className="game-hud-chip game-hud-chip--timer game-header-timer">
              {timeLeft}s
            </span>
          )}
        </div>
      ) : (
        <span className="game-header-spacer" aria-hidden="true" />
      )}
    </header>
  );
}
