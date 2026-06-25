import type { MascotMood } from './Mascot';

interface PixCompanionProps {
  mood?: MascotMood;
  size?: number;
  animate?: boolean;
  celebrate?: boolean;
  className?: string;
}

/** Pix — fiche vivante ScanPlay (pas une copie Duolingo). */
export function PixCompanion({
  mood = 'happy',
  size = 72,
  animate = false,
  celebrate = false,
  className = '',
}: PixCompanionProps) {
  const cls = [
    'pix-companion',
    `pix-companion--${mood}`,
    animate ? 'pix-companion--animate' : '',
    celebrate ? 'pix-companion--celebrate' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} style={{ width: size, height: size * 1.15 }} aria-hidden="true">
      <svg viewBox="0 0 100 115" className="pix-svg" role="img" aria-label="Pix">
        <defs>
          <linearGradient id="pixPlayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>
        {/* Corps fiche */}
        <rect x="12" y="18" width="68" height="78" rx="8" fill="#fff" stroke="#22c55e" strokeWidth="3" />
        <path d="M68 18 L80 30 L68 30 Z" fill="#f0fdf4" stroke="#22c55e" strokeWidth="2" />
        {/* Bouton PLAY */}
        <circle cx="46" cy="58" r="14" fill="url(#pixPlayGrad)" />
        <polygon points="42,52 42,64 54,58" fill="#fff" />
        {/* Yeux */}
        <ellipse className="pix-eye pix-eye--left" cx="34" cy="42" rx="7" ry="9" fill="#fff" stroke="#1e293b" strokeWidth="2" />
        <ellipse className="pix-eye pix-eye--right" cx="58" cy="42" rx="7" ry="9" fill="#fff" stroke="#1e293b" strokeWidth="2" />
        <circle className="pix-pupil pix-pupil--left" cx="36" cy="44" r="3" fill="#1e293b" />
        <circle className="pix-pupil pix-pupil--right" cx="60" cy="44" r="3" fill="#1e293b" />
        {/* Bras / jambes */}
        <line className="pix-limb pix-arm--left" x1="12" y1="55" x2="2" y2="48" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <line className="pix-limb pix-arm--right" x1="80" y1="55" x2="90" y2="48" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <line className="pix-limb pix-leg--left" x1="32" y1="96" x2="28" y2="110" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <line className="pix-limb pix-leg--right" x1="60" y1="96" x2="64" y2="110" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        {celebrate && (
          <>
            <circle className="pix-spark pix-spark--1" cx="8" cy="25" r="3" fill="#22c55e" />
            <circle className="pix-spark pix-spark--2" cx="92" cy="35" r="2.5" fill="#86efac" />
            <circle className="pix-spark pix-spark--3" cx="85" cy="12" r="2" fill="#4ade80" />
          </>
        )}
      </svg>
    </div>
  );
}
