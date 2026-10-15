import type { ReactNode } from 'react';
import type { DrivingSceneId } from '../../lib/drivingBelgium';

/** Crisp SVG scene illustrations for exam / exercise MCQs. */
export function DrivingSceneArt({
  id,
  className = '',
}: {
  id: DrivingSceneId;
  className?: string;
}) {
  return (
    <div className={`driving-scene-art ${className}`.trim()} data-scene={id}>
      <svg viewBox="0 0 360 200" className="driving-scene-svg" aria-hidden="true">
        {SCENE_DRAW[id]}
      </svg>
    </div>
  );
}

const SCENE_DRAW: Record<DrivingSceneId, ReactNode> = {
  'triangle-autoroute': (
    <>
      <rect width="360" height="200" fill="#4b5563" />
      <rect y="118" width="360" height="82" fill="#374151" />
      <rect x="0" y="168" width="360" height="10" fill="#f8fafc" opacity="0.92" />
      <rect x="0" y="148" width="360" height="4" fill="#f8fafc" opacity="0.35" />
      {/* warning triangle */}
      <g transform="translate(118,78)">
        <path
          d="M62 8 L118 108 L6 108 Z"
          fill="#ef4444"
          stroke="#f8fafc"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="M62 28 L100 98 L24 98 Z" fill="#fef08a" />
        <rect x="56" y="48" width="12" height="28" rx="2" fill="#111827" />
        <circle cx="62" cy="88" r="6" fill="#111827" />
      </g>
      <rect x="250" y="155" width="70" height="8" rx="2" fill="#f8fafc" opacity="0.85" />
    </>
  ),
  'feu-rouge': (
    <>
      <defs>
        <linearGradient id="skyFeu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>
      <rect width="360" height="200" fill="url(#skyFeu)" />
      <rect y="140" width="360" height="60" fill="#64748b" />
      <rect x="0" y="168" width="360" height="8" fill="#f8fafc" />
      <rect x="168" y="148" width="24" height="52" fill="#1f2937" rx="2" />
      <rect x="152" y="42" width="56" height="110" rx="10" fill="#111827" stroke="#334155" strokeWidth="3" />
      <circle cx="180" cy="68" r="14" fill="#ef4444" />
      <circle cx="180" cy="98" r="14" fill="#374151" />
      <circle cx="180" cy="128" r="14" fill="#374151" />
      <circle cx="180" cy="68" r="8" fill="#fecaca" opacity="0.9" />
    </>
  ),
  'passage-pietons': (
    <>
      <rect width="360" height="200" fill="#86efac" opacity="0.35" />
      <rect y="70" width="360" height="100" fill="#6b7280" />
      {[40, 80, 120, 160, 200, 240, 280].map((x) => (
        <rect key={x} x={x} y="78" width="22" height="84" fill="#f8fafc" rx="1" />
      ))}
      <circle cx="175" cy="58" r="12" fill="#fbbf24" />
      <path d="M168 70 h14 v28 h-14 z" fill="#2563eb" />
      <path d="M160 98 h30 v6 h-8 v26 h-14 v-26 z" fill="#1e3a8a" />
    </>
  ),
  ceinture: (
    <>
      <rect width="360" height="200" fill="#e2e8f0" />
      <ellipse cx="180" cy="170" rx="110" ry="22" fill="#cbd5e1" />
      <circle cx="180" cy="78" r="28" fill="#fcd34d" />
      <path d="M140 110 q40 50 80 0 v50 q-40 20 -80 0 z" fill="#3b82f6" />
      <path
        d="M118 118 Q180 150 242 118"
        fill="none"
        stroke="#111827"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <rect x="168" y="132" width="24" height="16" rx="3" fill="#fbbf24" stroke="#92400e" strokeWidth="2" />
    </>
  ),
  telephone: (
    <>
      <rect width="360" height="200" fill="#f1f5f9" />
      <rect x="40" y="40" width="200" height="120" rx="16" fill="#94a3b8" />
      <rect x="52" y="52" width="176" height="70" rx="6" fill="#e0f2fe" />
      <circle cx="140" cy="145" r="10" fill="#64748b" />
      <g transform="translate(236,70)">
        <rect x="0" y="0" width="52" height="90" rx="10" fill="#111827" />
        <rect x="6" y="10" width="40" height="58" rx="4" fill="#38bdf8" />
        <circle cx="26" cy="78" r="5" fill="#64748b" />
      </g>
      <path d="M220 95 Q248 70 260 95" fill="none" stroke="#ef4444" strokeWidth="4" strokeDasharray="6 4" />
    </>
  ),
  alcool: (
    <>
      <rect width="360" height="200" fill="#fef3c7" />
      <ellipse cx="180" cy="168" rx="90" ry="16" fill="#fde68a" />
      <path d="M150 40 h60 v20 h-12 v70 q0 28 -18 28 t-18 -28 V60 h-12 z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="3" />
      <path d="M158 95 h44 v28 q0 18 -22 18 t-22 -18 z" fill="#f87171" opacity="0.85" />
      <text x="180" y="130" textAnchor="middle" fontSize="22" fontWeight="900" fill="#7f1d1d">
        %
      </text>
      <circle cx="250" cy="70" r="28" fill="#fee2e2" stroke="#ef4444" strokeWidth="4" />
      <path d="M238 58 L262 82 M262 58 L238 82" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  'priorite-droite': (
    <>
      <rect width="360" height="200" fill="#bbf7d0" opacity="0.5" />
      <path d="M0 100 H360 M180 0 V200" stroke="#6b7280" strokeWidth="54" />
      <path d="M0 100 H360 M180 0 V200" stroke="#f8fafc" strokeWidth="4" strokeDasharray="14 12" />
      {/* car from right */}
      <g transform="translate(230,78)">
        <rect x="0" y="18" width="70" height="28" rx="8" fill="#ef4444" />
        <rect x="12" y="8" width="40" height="18" rx="4" fill="#fecaca" />
        <circle cx="16" cy="48" r="8" fill="#111827" />
        <circle cx="54" cy="48" r="8" fill="#111827" />
      </g>
      {/* car from bottom */}
      <g transform="translate(152,118)">
        <rect x="8" y="0" width="40" height="58" rx="8" fill="#3b82f6" />
        <rect x="14" y="8" width="28" height="22" rx="3" fill="#bfdbfe" />
        <circle cx="14" cy="48" r="7" fill="#111827" />
        <circle cx="42" cy="48" r="7" fill="#111827" />
      </g>
      <polygon points="300,70 320,100 280,100" fill="#eab308" stroke="#92400e" strokeWidth="2" />
    </>
  ),
  'distance-securite': (
    <>
      <rect width="360" height="200" fill="#dbeafe" />
      <rect y="120" width="360" height="80" fill="#64748b" />
      <rect x="0" y="155" width="360" height="6" fill="#f8fafc" opacity="0.7" />
      <g transform="translate(40,95)">
        <rect x="0" y="20" width="88" height="36" rx="8" fill="#f8fafc" />
        <rect x="14" y="8" width="52" height="22" rx="4" fill="#bae6fd" />
        <circle cx="20" cy="58" r="9" fill="#111827" />
        <circle cx="68" cy="58" r="9" fill="#111827" />
      </g>
      <g transform="translate(220,95)">
        <rect x="0" y="20" width="88" height="36" rx="8" fill="#fbbf24" />
        <rect x="14" y="8" width="52" height="22" rx="4" fill="#fef3c7" />
        <circle cx="20" cy="58" r="9" fill="#111827" />
        <circle cx="68" cy="58" r="9" fill="#111827" />
      </g>
      <path
        d="M140 130 H208"
        stroke="#22c55e"
        strokeWidth="5"
        strokeDasharray="8 6"
        strokeLinecap="round"
      />
      <text x="174" y="118" textAnchor="middle" fontSize="14" fontWeight="800" fill="#166534">
        2s
      </text>
    </>
  ),
  'bande-urgence': (
    <>
      <rect width="360" height="200" fill="#9ca3af" />
      <rect y="40" width="260" height="160" fill="#4b5563" />
      <rect x="260" y="40" width="100" height="160" fill="#6b7280" />
      <rect x="250" y="40" width="10" height="160" fill="#f8fafc" />
      <rect x="40" y="100" width="80" height="8" fill="#f8fafc" opacity="0.5" />
      <rect x="140" y="100" width="80" height="8" fill="#f8fafc" opacity="0.5" />
      <g transform="translate(275,95)">
        <rect x="0" y="18" width="58" height="28" rx="6" fill="#ef4444" />
        <rect x="8" y="6" width="36" height="18" rx="3" fill="#fecaca" />
        <circle cx="12" cy="48" r="7" fill="#111827" />
        <circle cx="46" cy="48" r="7" fill="#111827" />
      </g>
      <text x="310" y="30" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fef08a">
        BAU
      </text>
    </>
  ),
  'rond-point': (
    <>
      <rect width="360" height="200" fill="#bbf7d0" opacity="0.45" />
      <circle cx="180" cy="100" r="78" fill="#6b7280" />
      <circle cx="180" cy="100" r="38" fill="#86efac" stroke="#22c55e" strokeWidth="4" />
      <circle cx="180" cy="100" r="58" fill="none" stroke="#f8fafc" strokeWidth="5" strokeDasharray="16 12" />
      <g transform="translate(230,70)">
        <rect x="0" y="10" width="48" height="26" rx="6" fill="#3b82f6" />
        <circle cx="12" cy="38" r="6" fill="#111827" />
        <circle cx="36" cy="38" r="6" fill="#111827" />
      </g>
      <path d="M248 55 l18 8 -8 14" fill="none" stroke="#eab308" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};
