import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface GameProgressBarProps {
  value: number;
}

/** Progression 0–100 pour la barre Duolingo-style en tête de jeu. */
export function gameProgressPct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

export function GameProgressBar({ value }: GameProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  const prevRef = useRef(pct);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (pct > prevRef.current) {
      setPulse(true);
      const timer = window.setTimeout(() => setPulse(false), 450);
      prevRef.current = pct;
      return () => window.clearTimeout(timer);
    }
    prevRef.current = pct;
  }, [pct]);

  const excitement = pct / 100;

  return (
    <div
      className="game-progress-bar"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`game-progress-fill${pulse ? ' game-progress-fill--pulse' : ''}`}
        style={
          {
            width: `${pct}%`,
            '--progress-excitement': excitement,
          } as CSSProperties
        }
      >
        <span className="game-progress-shine" aria-hidden="true" />
      </div>
    </div>
  );
}
