import type { CSSProperties, ReactNode } from 'react';
import { useId } from 'react';

interface AchievementShieldFrameProps {
  children: ReactNode;
  locked?: boolean;
  /** Width in px; height follows shield proportions. */
  size?: number;
  className?: string;
  /** Accent for the fill gradient (CSS color). */
  accent?: string;
}

/**
 * Soft rounded shield badge — SVG curves, not a clipped polygon.
 * White stroke stays smooth on the shoulders.
 */
export function AchievementShieldFrame({
  children,
  locked = false,
  size = 88,
  className = '',
  accent,
}: AchievementShieldFrameProps) {
  const uid = useId().replace(/:/g, '');
  const height = Math.round(size * (96 / 88));
  const style = {
    width: size,
    height,
    ...(accent ? ({ '--ach-shield-accent': accent } as CSSProperties) : null),
  } as CSSProperties;

  return (
    <span
      className={`ach-shield-frame${locked ? ' ach-shield-frame--locked' : ' ach-shield-frame--live'}${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden="true"
    >
      <svg className="ach-shield-frame-svg" viewBox="0 0 80 92" width={size} height={height}>
        <defs>
          <linearGradient id={`ach-sh-fill-${uid}`} x1="40" y1="2" x2="40" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" className="ach-shield-stop-a" />
            <stop offset="55%" className="ach-shield-stop-b" />
            <stop offset="100%" className="ach-shield-stop-c" />
          </linearGradient>
          <linearGradient id={`ach-sh-shine-${uid}`} x1="40" y1="4" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id={`ach-sh-soft-${uid}`} x="-20%" y="-15%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#0f172a" floodOpacity="0.22" />
          </filter>
        </defs>
        {/* Outer soft plate */}
        <path
          d="M40 3
             C54.5 3 68 7.2 72.8 14.2
             C77.2 20.8 77.5 30.5 77.5 42
             C77.5 57.5 69.2 71.5 40 88
             C10.8 71.5 2.5 57.5 2.5 42
             C2.5 30.5 2.8 20.8 7.2 14.2
             C12 7.2 25.5 3 40 3Z"
          fill={`url(#ach-sh-fill-${uid})`}
          filter={`url(#ach-sh-soft-${uid})`}
        />
        {/* Rounded white rim */}
        <path
          d="M40 3
             C54.5 3 68 7.2 72.8 14.2
             C77.2 20.8 77.5 30.5 77.5 42
             C77.5 57.5 69.2 71.5 40 88
             C10.8 71.5 2.5 57.5 2.5 42
             C2.5 30.5 2.8 20.8 7.2 14.2
             C12 7.2 25.5 3 40 3Z"
          fill="none"
          stroke="#fff"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Inner highlight */}
        <path
          d="M40 8
             C52 8 64 11.5 68 17
             C71.5 22 72 29 72 38
             C72 48 68 56 40 70
             C12 56 8 48 8 38
             C8 29 8.5 22 12 17
             C16 11.5 28 8 40 8Z"
          fill={`url(#ach-sh-shine-${uid})`}
        />
      </svg>
      <span className="ach-shield-frame-icon">{children}</span>
    </span>
  );
}
