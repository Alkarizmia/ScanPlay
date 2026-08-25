import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface GameProgressBarProps {
  value: number;
}

/** Progression 0–100 pour la barre Duolingo-style en tête de jeu. */
export function gameProgressPct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

function chargeColor(pct: number): string {
  const t = Math.min(1, Math.max(0, pct / 100));
  const hue = 128 - t * 128;
  const sat = 72 + t * 16;
  const light = 46 - t * 6;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

export function GameProgressBar({ value }: GameProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
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

  const hueEnd = 128 - (pct / 100) * 128;
  const chargeClass =
    pct >= 94 ? ' game-progress-bar--explode' : pct >= 78 ? ' game-progress-bar--charge' : '';

  return (
    <div
      className={`game-progress-bar${chargeClass}`}
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
            '--progress-excitement': pct / 100,
            '--progress-color-start': chargeColor(Math.max(0, pct - 28)),
            '--progress-color-end': `hsl(${hueEnd} ${72 + (pct / 100) * 16}% ${46 - (pct / 100) * 6}%)`,
          } as CSSProperties
        }
      >
        <span className="game-progress-shine" aria-hidden="true" />
      </div>
    </div>
  );
}
