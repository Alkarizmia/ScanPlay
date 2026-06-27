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

  const showSparks = celebrate || mood === 'excited';
  const showQuestion = mood === 'thinking';
  const showScanBeam = mood === 'running' || mood === 'excited';
  const showMotion = mood === 'running';

  return (
    <div className={cls} style={{ width: size, height: size * 1.15 }} aria-hidden="true">
      <svg viewBox="0 0 100 115" className="pix-svg" role="img" aria-label="Pix">
        <defs>
          <linearGradient id="pixPlayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>
        {showMotion && (
          <>
            <line className="pix-motion pix-motion--1" x1="4" y1="58" x2="14" y2="58" stroke="#86efac" strokeWidth="3" strokeLinecap="round" />
            <line className="pix-motion pix-motion--2" x1="2" y1="68" x2="12" y2="68" stroke="#bbf7d0" strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}
        {showScanBeam && (
          <polygon className="pix-scan-beam" points="72,40 98,48 72,56" fill="#4ade80" opacity="0.85" />
        )}
        <rect x="12" y="18" width="68" height="78" rx="8" fill="#fff" stroke="#22c55e" strokeWidth="3" />
        <path d="M68 18 L80 30 L68 30 Z" fill="#f0fdf4" stroke="#22c55e" strokeWidth="2" />
        <circle cx="46" cy="58" r="14" fill="url(#pixPlayGrad)" />
        <polygon points="42,52 42,64 54,58" fill="#fff" />
        <ellipse className="pix-eye pix-eye--left" cx="34" cy="42" rx="7" ry="9" fill="#fff" stroke="#1e293b" strokeWidth="2" />
        <ellipse className="pix-eye pix-eye--right" cx="58" cy="42" rx="7" ry="9" fill="#fff" stroke="#1e293b" strokeWidth="2" />
        <circle className="pix-pupil pix-pupil--left" cx="36" cy="44" r="3" fill="#1e293b" />
        <circle className="pix-pupil pix-pupil--right" cx="60" cy="44" r="3" fill="#1e293b" />
        <line className="pix-limb pix-arm--left" x1="12" y1="55" x2="2" y2="48" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <line className="pix-limb pix-arm--right" x1="80" y1="55" x2="90" y2="48" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <line className="pix-limb pix-leg--left" x1="32" y1="96" x2="28" y2="110" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <line className="pix-limb pix-leg--right" x1="60" y1="96" x2="64" y2="110" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        {showQuestion && (
          <text className="pix-question" x="78" y="22" fontSize="16" fontWeight="800" fill="#22c55e">
            ?
          </text>
        )}
        {showSparks && (
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
