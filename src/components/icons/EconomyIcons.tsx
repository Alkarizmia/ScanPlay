import { useId, type ReactNode } from 'react';
import type { EconomyGlyphId } from '../../lib/economyGlyph';
import { ListenIcon, QuizIcon, WriteIcon } from './PathGameIcons';
import { StreakFlame } from './StreakFlame';

export type { EconomyGlyphId };

export type MedalTier = 'bronze' | 'silver' | 'gold' | 'iron';

interface IconProps {
  size?: number;
  className?: string;
}

function StrokeIcon({ size = 22, className = '', children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const SW = '2.2';

export function CoinIcon({ size = 22, className = 'sp-icon sp-icon--coin' }: IconProps) {
  return (
    <StrokeIcon size={size} className={className}>
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth={SW} />
      <circle cx="12" cy="12" r="5.1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8.6v6.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </StrokeIcon>
  );
}

export function GemIcon({ size = 22, className = 'sp-icon sp-icon--gem' }: IconProps) {
  return (
    <StrokeIcon size={size} className={className}>
      <path
        d="M7.2 5.8h9.6L21 10.2 12 20.2 3 10.2Z"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <path d="M7.2 5.8 12 10.2 16.8 5.8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3 10.2h18" stroke="currentColor" strokeWidth="1.7" />
    </StrokeIcon>
  );
}

export function XpBoltIcon({ size = 22, className = 'sp-icon sp-icon--xp' }: IconProps) {
  return (
    <StrokeIcon size={size} className={className}>
      <path
        d="M13.6 3.4 6.4 13.2h5.2L10.4 20.6l7.2-9.8h-5.2Z"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </StrokeIcon>
  );
}

export function PotionIcon({ size = 22, className = 'sp-icon sp-icon--potion' }: IconProps) {
  return (
    <StrokeIcon size={size} className={className}>
      <path d="M10 3.4h4" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M11 3.4V7.2" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M13 3.4V7.2" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path
        d="M8.4 8.2h7.2c.2 1.4.8 2.6 1.8 4.1 1 1.5 1.2 3.1.4 4.6-.9 1.7-2.8 2.9-5.8 2.9s-4.9-1.2-5.8-2.9c-.8-1.5-.6-3.1.4-4.6 1-1.5 1.6-2.7 1.8-4.1Z"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <path d="M7.6 13.4h8.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </StrokeIcon>
  );
}

export function MegaPotionIcon({ size = 22, className = 'sp-icon sp-icon--mega' }: IconProps) {
  return (
    <StrokeIcon size={size} className={className}>
      <path d="M9.6 2.8h4.8" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M10.6 2.8V6.6" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path d="M13.4 2.8V6.6" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path
        d="M8 7.6h8c.25 1.6 1 3 2.2 4.6 1.1 1.5 1.3 3.2.3 4.8-1 1.8-3.2 3.1-6.5 3.1s-5.5-1.3-6.5-3.1c-1-1.6-.8-3.3.3-4.8 1.2-1.6 1.95-3 2.2-4.6Z"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <path d="M12 12.2v4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.9 14.3h4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </StrokeIcon>
  );
}

export function ScanBonusIcon({ size = 22, className = 'sp-icon sp-icon--scan' }: IconProps) {
  return (
    <StrokeIcon size={size} className={className}>
      <rect x="4.2" y="6.4" width="15.6" height="12.2" rx="2.4" stroke="currentColor" strokeWidth={SW} />
      <circle cx="12" cy="12.4" r="3.2" stroke="currentColor" strokeWidth={SW} />
      <path d="M8.2 6.4 9.4 4.6h5.2L15.8 6.4" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
    </StrokeIcon>
  );
}

export function SynthesisIcon({ size = 22, className = 'sp-icon sp-icon--synthesis' }: IconProps) {
  return (
    <StrokeIcon size={size} className={className}>
      <path
        d="M6.2 5.2h8.4L17.8 8.4v10.4H6.2V5.2Z"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <path d="M14.4 5.2v3.4h3.4" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
      <path d="M8.6 12.2h6.4M8.6 15.2h4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M16.8 4.2v2.4M15.6 5.4h2.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </StrokeIcon>
  );
}

export function MedalIcon({
  size = 22,
  className,
  tier = 'gold',
}: IconProps & { tier?: MedalTier }) {
  const tone = `sp-icon sp-icon--medal-${tier}`;
  return (
    <StrokeIcon size={size} className={className ?? tone}>
      <circle cx="12" cy="9" r="5.4" stroke="currentColor" strokeWidth={SW} />
      <circle cx="12" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.6 13.6 6.8 21.1 12 18.2 17.2 21.1 15.4 13.6"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </StrokeIcon>
  );
}

function lootUid(prefix: string, id: string) {
  return `${prefix}${id.replace(/:/g, '')}`;
}

function lootClass(kind: string, size: number, className: string) {
  const inline = size <= 24 ? 'loot-token--inline' : '';
  return `loot-token loot-token--${kind} ${inline} ${className}`.trim();
}

/** Jeton peint — pièces, gemmes, médailles (pas le pictogramme de navigation). */
export function LootCoin({ size = 36, className = '' }: IconProps) {
  const gid = lootUid('lootCoinFill', useId());
  return (
    <svg className={lootClass('coin', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="6" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffe9a3" />
          <stop offset="45%" stopColor="#f5c518" />
          <stop offset="100%" stopColor="#c4840e" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill={`url(#${gid})`} />
      <circle cx="16" cy="16" r="13" fill="none" stroke="#8a5a08" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="9.2" fill="none" stroke="#fff3c4" strokeWidth="1.4" opacity="0.85" />
      <path d="M16 10.2v11.6" fill="none" stroke="#8a5a08" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="12" cy="11" rx="3.2" ry="1.6" fill="#fff8dc" opacity="0.55" />
    </svg>
  );
}

export function LootGem({ size = 36, className = '' }: IconProps) {
  const gid = lootUid('lootGemFill', useId());
  return (
    <svg className={lootClass('gem', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="8" y1="4" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#b8ecff" />
          <stop offset="40%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
      </defs>
      <path d="M10.2 6.4h11.6L26.4 13 16 26.2 5.6 13Z" fill={`url(#${gid})`} stroke="#075985" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10.2 6.4 16 13.2 21.8 6.4" fill="none" stroke="#e0f7ff" strokeWidth="1.2" opacity="0.9" />
      <path d="M5.6 13h20.8" fill="none" stroke="#7dd3fc" strokeWidth="1.1" opacity="0.8" />
    </svg>
  );
}

export function LootMedal({ size = 36, className = '' }: IconProps) {
  const gid = lootUid('lootMedalFill', useId());
  return (
    <svg className={lootClass('medal', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="8" y1="4" x2="24" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="55%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#a16207" />
        </linearGradient>
      </defs>
      <path d="M11.2 18.4 8.6 28.2 16 24.2 23.4 28.2 20.8 18.4" fill="#dc2626" stroke="#9f1239" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="16" cy="12.2" r="8.2" fill={`url(#${gid})`} stroke="#854d0e" strokeWidth="1.5" />
      <circle cx="16" cy="12.2" r="4.4" fill="none" stroke="#fff4c2" strokeWidth="1.4" />
      <ellipse cx="13.2" cy="9.4" rx="2.4" ry="1.3" fill="#fff8dc" opacity="0.55" />
    </svg>
  );
}

export function LootXp({ size = 32, className = '' }: IconProps) {
  const gid = lootUid('lootXpFill', useId());
  return (
    <svg className={lootClass('xp', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="8" y1="3" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#bbf7d0" />
          <stop offset="40%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <path
        d="M18.2 3.6 8.4 16.4h6.4L13.2 28.4l10.2-13.2h-6.6Z"
        fill={`url(#${gid})`}
        stroke="#166534"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M14.6 16.4h5.2" fill="none" stroke="#ecfdf5" strokeWidth="1.2" opacity="0.7" />
    </svg>
  );
}

export function LootScan({ size = 32, className = '' }: IconProps) {
  const body = lootUid('lootScanBody', useId());
  const lens = lootUid('lootScanLens', useId());
  return (
    <svg className={lootClass('scan', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={body} x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="55%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
        <radialGradient id={lens} cx="46%" cy="38%" r="58%">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="55%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#075985" />
        </radialGradient>
      </defs>
      <rect x="4.2" y="9.2" width="23.6" height="16.4" rx="4.2" fill={`url(#${body})`} stroke="#14532d" strokeWidth="1.4" />
      <path d="M11 9.2 12.6 6.2h6.8L21 9.2" fill="#4ade80" stroke="#14532d" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="16" cy="17.2" r="5.4" fill={`url(#${lens})`} stroke="#0c4a6e" strokeWidth="1.4" />
      <circle cx="16" cy="17.2" r="2.2" fill="#082f49" />
      <circle cx="14.4" cy="15.6" r="1.1" fill="#f0f9ff" opacity="0.85" />
      <rect x="22.2" y="12.2" width="2.6" height="2.2" rx="0.6" fill="#fef08a" stroke="#a16207" strokeWidth="0.8" />
    </svg>
  );
}

export function LootQuiz({ size = 32, className = '' }: IconProps) {
  const gid = lootUid('lootQuizFill', useId());
  return (
    <svg className={lootClass('quiz', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="6" y1="4" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#bef264" />
          <stop offset="50%" stopColor="#65a30d" />
          <stop offset="100%" stopColor="#3f6212" />
        </linearGradient>
      </defs>
      <path
        d="M6.4 6.2h19.2v14.6H14.2L6.4 26.4V6.2Z"
        fill={`url(#${gid})`}
        stroke="#1a2e05"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M12.4 12.2c0-1.7 1.3-2.9 3.2-2.9 1.8 0 3.1 1.1 3.1 2.7 0 1.5-1.1 2.2-2.2 2.8-.8.4-1.1.8-1.1 1.5"
        fill="none"
        stroke="#f7fee7"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="15.6" cy="19.1" r="1.15" fill="#f7fee7" />
    </svg>
  );
}

export function LootPotion({ size = 36, className = '' }: IconProps) {
  const glass = lootUid('lootPotionGlass', useId());
  const liquid = lootUid('lootPotionLiquid', useId());
  return (
    <svg className={lootClass('potion', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={glass} x1="8" y1="6" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f5d0fe" />
          <stop offset="55%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
        <linearGradient id={liquid} x1="8" y1="14" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e879f9" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <path d="M13.2 3.4h5.6" stroke="#a16207" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="13.4" y="3.2" width="5.2" height="3.4" rx="1" fill="#fbbf24" stroke="#92400e" strokeWidth="1.1" />
      <path d="M14.2 6.6V9.2" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.8 6.6V9.2" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M10.4 10h11.2c.3 1.6 1.1 3.2 2.4 5.1 1.2 1.8 1.5 3.7.4 5.5-1.1 1.9-3.4 3.4-7.4 3.4s-6.3-1.5-7.4-3.4c-1.1-1.8-.8-3.7.4-5.5 1.3-1.9 2.1-3.5 2.4-5.1Z"
        fill={`url(#${glass})`}
        stroke="#4c1d95"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M8.6 16.6c1.8 4.4 13 4.4 14.8 0-1 3.8-3.6 6.2-7.4 6.2s-6.4-2.4-7.4-6.2Z" fill={`url(#${liquid})`} />
      <ellipse cx="12.4" cy="13.2" rx="2.2" ry="1.2" fill="#fae8ff" opacity="0.7" />
    </svg>
  );
}

export function LootMegaPotion({ size = 36, className = '' }: IconProps) {
  const glass = lootUid('lootMegaGlass', useId());
  const liquid = lootUid('lootMegaLiquid', useId());
  return (
    <svg className={lootClass('mega', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={glass} x1="6" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="50%" stopColor="#e11d48" />
          <stop offset="100%" stopColor="#9f1239" />
        </linearGradient>
        <linearGradient id={liquid} x1="8" y1="14" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#be123c" />
        </linearGradient>
      </defs>
      <path d="M12.6 2.6h6.8" stroke="#a16207" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="12.8" y="2.4" width="6.4" height="3.6" rx="1" fill="#f59e0b" stroke="#78350f" strokeWidth="1.1" />
      <path
        d="M9.6 8.4h12.8c.4 1.8 1.3 3.6 2.7 5.6 1.3 1.9 1.5 4 .3 5.9-1.3 2.1-3.8 3.6-8.4 3.6s-7.1-1.5-8.4-3.6c-1.2-1.9-1-4 .3-5.9 1.4-2 2.3-3.8 2.7-5.6Z"
        fill={`url(#${glass})`}
        stroke="#881337"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M7.8 16.4c2 5 14.4 5 16.4 0-1.2 4.2-4.2 6.8-8.2 6.8s-7-2.6-8.2-6.8Z" fill={`url(#${liquid})`} />
      <path d="M16 13.6v5.2M13.4 16.2h5.2" stroke="#fff1f2" strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="12.2" cy="12.4" rx="2.1" ry="1.1" fill="#ffe4e6" opacity="0.75" />
    </svg>
  );
}

export function LootSynthesis({ size = 36, className = '' }: IconProps) {
  const page = lootUid('lootSynthPage', useId());
  const spark = lootUid('lootSynthSpark', useId());
  return (
    <svg className={lootClass('synth', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={page} x1="6" y1="4" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="45%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id={spark} x1="18" y1="3" x2="28" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <path
        d="M7.2 5.4h12.4L23.6 9.6v16H7.2V5.4Z"
        fill={`url(#${page})`}
        stroke="#0c4a6e"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M19.4 5.4v4.4h4.2" fill="#7dd3fc" stroke="#0c4a6e" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M10.4 14.2h9.2M10.4 17.6h7.4M10.4 21h5.2" stroke="#e0f2fe" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M24.2 6.2 25.4 8.8 28 10l-2.6 1.2-1.2 2.6-1.2-2.6L20.4 10l2.6-1.2Z"
        fill={`url(#${spark})`}
        stroke="#a16207"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LootHint({ size = 36, className = '' }: IconProps) {
  const bulb = lootUid('lootHintBulb', useId());
  return (
    <svg className={lootClass('hint', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id={bulb} cx="42%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="45%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
      </defs>
      <path
        d="M10.2 13.2a5.8 5.8 0 1 1 11.6 0c0 2.4-1.4 3.7-2.4 4.8-.7.7-1.1 1.5-1.1 2.4h-4.6c0-.9-.4-1.7-1.1-2.4-1-1.1-2.4-2.4-2.4-4.8Z"
        fill={`url(#${bulb})`}
        stroke="#92400e"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <rect x="12.6" y="21.6" width="6.8" height="2.2" rx="0.8" fill="#fde68a" stroke="#92400e" strokeWidth="1.1" />
      <rect x="13.2" y="24.2" width="5.6" height="2" rx="0.8" fill="#fbbf24" stroke="#92400e" strokeWidth="1.1" />
      <ellipse cx="13.6" cy="11.4" rx="2" ry="1.3" fill="#fffbeb" opacity="0.75" />
      <path d="M16 4.4v2.2M23.4 8.2l-1.6 1.4M8.6 8.2l1.6 1.4" stroke="#fde047" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function LootShield({ size = 36, className = '' }: IconProps) {
  const shield = lootUid('lootShieldFill', useId());
  const ice = lootUid('lootShieldIce', useId());
  return (
    <svg className={lootClass('freeze', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={shield} x1="8" y1="4" x2="22" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="40%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id={ice} x1="12" y1="10" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>
      </defs>
      <path
        d="M16 3.6 24.4 7v6.6c0 5.4-3.6 8.8-8.4 10.6C11.2 22.4 7.6 19 7.6 13.6V7Z"
        fill={`url(#${shield})`}
        stroke="#0c4a6e"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M16 8.6v9.2M12.4 11.4h7.2M12.8 15.4h6.4" stroke={`url(#${ice})`} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="13.2" cy="9.2" rx="2.4" ry="1.2" fill="#f0f9ff" opacity="0.7" />
    </svg>
  );
}

export function LootFlag({ size = 36, className = '' }: IconProps) {
  const gid = lootUid('lootFlagFill', useId());
  return (
    <svg className={lootClass('flag', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="8" y1="4" x2="24" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <path d="M8.4 4.4v23.2" stroke="#334155" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9.4 5.2h14.2L20.2 10.4 23.6 15.6H9.4V5.2Z" fill={`url(#${gid})`} stroke="#14532d" strokeWidth="1.3" strokeLinejoin="round" />
      <ellipse cx="12.6" cy="8.2" rx="2" ry="1" fill="#dcfce7" opacity="0.7" />
    </svg>
  );
}

export function LootPeople({ size = 36, className = '' }: IconProps) {
  const gid = lootUid('lootPeopleFill', useId());
  return (
    <svg className={lootClass('people', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="8" y1="6" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <circle cx="11.2" cy="10.4" r="4.2" fill={`url(#${gid})`} stroke="#1e3a8a" strokeWidth="1.2" />
      <circle cx="20.8" cy="11.2" r="3.6" fill="#60a5fa" stroke="#1e3a8a" strokeWidth="1.2" />
      <path d="M4.8 25.4c.4-4.8 3.4-7.4 6.4-7.4s6 2.6 6.4 7.4" fill="#3b82f6" stroke="#1e3a8a" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M14.6 25.4c.3-3.8 2.6-6 5.4-6s5.2 2.2 5.6 6" fill="#93c5fd" stroke="#1e3a8a" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function LootCards({ size = 36, className = '' }: IconProps) {
  const a = lootUid('lootCardA', useId());
  const b = lootUid('lootCardB', useId());
  return (
    <svg className={lootClass('cards', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={a} x1="6" y1="6" x2="20" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id={b} x1="10" y1="4" x2="26" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#bbf7d0" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <rect x="4.4" y="8.2" width="14.4" height="18.2" rx="2.4" transform="rotate(-12 11.6 17.3)" fill={`url(#${a})`} stroke="#92400e" strokeWidth="1.3" />
      <rect x="12.2" y="5.6" width="14.4" height="18.2" rx="2.4" transform="rotate(10 19.4 14.7)" fill={`url(#${b})`} stroke="#14532d" strokeWidth="1.3" />
      <path d="M16.4 12.4h6.2M16.4 15.4h4.6" stroke="#dcfce7" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function LootMic({ size = 36, className = '' }: IconProps) {
  const gid = lootUid('lootMicFill', useId());
  return (
    <svg className={lootClass('mic', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="10" y1="4" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f5d0fe" />
          <stop offset="100%" stopColor="#a21caf" />
        </linearGradient>
      </defs>
      <rect x="12.2" y="4.4" width="7.6" height="13.2" rx="3.8" fill={`url(#${gid})`} stroke="#701a75" strokeWidth="1.3" />
      <path d="M9.4 14.2c0 4 2.8 6.4 6.6 6.4s6.6-2.4 6.6-6.4" fill="none" stroke="#86198f" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 20.8v5.2M12.2 26.2h7.6" stroke="#701a75" strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="14.2" cy="8.2" rx="1.5" ry="2.2" fill="#fae8ff" opacity="0.7" />
    </svg>
  );
}

export function LootTiles({ size = 36, className = '' }: IconProps) {
  return (
    <svg className={lootClass('tiles', size, className)} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4.2" y="6.2" width="11.2" height="11.2" rx="2.4" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="1.3" />
      <rect x="16.6" y="14.6" width="11.2" height="11.2" rx="2.4" fill="#4ade80" stroke="#14532d" strokeWidth="1.3" />
      <path d="M14.2 12.4 18.6 16.8" stroke="#facc15" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function StreakFreezeIcon({ size = 22, className = 'sp-icon sp-icon--freeze' }: IconProps) {
  return (
    <StrokeIcon size={size} className={className}>
      <path
        d="M12 3.4 19.2 6.6v5.4c0 4.4-3 7.2-7.2 8.6-4.2-1.4-7.2-4.2-7.2-8.6V6.6Z"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <path d="M12 8.2v6.4M9.4 10.4h5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </StrokeIcon>
  );
}

export function PathFlagIcon({ size = 22, className = 'sp-icon sp-icon--path' }: IconProps) {
  return (
    <StrokeIcon size={size} className={className}>
      <path d="M7.2 20.4V4.4" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <path
        d="M7.2 5h10.2L15.4 8.4 17.4 11.8H7.2"
        stroke="currentColor"
        strokeWidth={SW}
        strokeLinejoin="round"
      />
    </StrokeIcon>
  );
}

const TONE: Record<EconomyGlyphId, string> = {
  coin: 'sp-icon sp-icon--coin',
  gem: 'sp-icon sp-icon--gem',
  xp: 'sp-icon sp-icon--xp',
  potion: 'sp-icon sp-icon--potion',
  megaPotion: 'sp-icon sp-icon--mega',
  scan: 'sp-icon sp-icon--scan',
  synthesis: 'sp-icon sp-icon--synthesis',
  streak: 'sp-icon',
  hint: 'sp-icon sp-icon--hint',
  freeze: 'sp-icon sp-icon--freeze',
  'medal-bronze': 'sp-icon sp-icon--medal-bronze',
  'medal-silver': 'sp-icon sp-icon--medal-silver',
  'medal-gold': 'sp-icon sp-icon--medal-gold',
  'medal-iron': 'sp-icon sp-icon--medal-iron',
  listen: 'sp-icon sp-icon--quiz',
  write: 'sp-icon sp-icon--write',
  quiz: 'sp-icon sp-icon--quiz',
  path: 'sp-icon sp-icon--path',
};

const GLYPH_IDS = new Set<string>(Object.keys(TONE));

/** Old notification / cache payloads that still store an emoji. */
const LEGACY_EMOJI: Record<string, EconomyGlyphId> = {
  '🪙': 'coin',
  '💎': 'gem',
  '⚡': 'xp',
  '✨': 'xp',
  '⭐': 'xp',
  '🌟': 'xp',
  '⚗️': 'potion',
  '🧪': 'megaPotion',
  '📷': 'scan',
  '📸': 'scan',
  '🔥': 'streak',
  '🥇': 'medal-gold',
  '🏅': 'medal-gold',
  '🏆': 'medal-gold',
  '🥉': 'medal-bronze',
  '💡': 'hint',
  '🛡️': 'freeze',
};

export function isEconomyGlyphId(value: string): value is EconomyGlyphId {
  return GLYPH_IDS.has(value);
}

export function resolveEconomyGlyphId(raw: string | undefined): EconomyGlyphId {
  if (!raw) return 'medal-gold';
  if (isEconomyGlyphId(raw)) return raw;
  return LEGACY_EMOJI[raw] ?? 'medal-gold';
}

export function EconomyGlyph({
  id,
  size = 22,
  className = '',
}: {
  id: EconomyGlyphId | string;
  size?: number;
  className?: string;
}) {
  const glyph = resolveEconomyGlyphId(id);
  const tone = `${TONE[glyph]} ${className}`.trim();

  switch (glyph) {
    case 'coin':
      return <LootCoin size={size} className={className} />;
    case 'gem':
      return <LootGem size={size} className={className} />;
    case 'xp':
      return <XpBoltIcon size={size} className={tone} />;
    case 'potion':
      return <LootPotion size={size} className={className} />;
    case 'megaPotion':
      return <LootMegaPotion size={size} className={className} />;
    case 'scan':
      return <ScanBonusIcon size={size} className={tone} />;
    case 'synthesis':
      return <LootSynthesis size={size} className={className} />;
    case 'streak':
      return <StreakFlame lit size={size} className={tone} />;
    case 'hint':
      return <LootHint size={size} className={className} />;
    case 'freeze':
      return <LootShield size={size} className={className} />;
    case 'medal-bronze':
      return <MedalIcon size={size} className={tone} tier="bronze" />;
    case 'medal-silver':
      return <MedalIcon size={size} className={tone} tier="silver" />;
    case 'medal-gold':
      return <MedalIcon size={size} className={tone} tier="gold" />;
    case 'medal-iron':
      return <MedalIcon size={size} className={tone} tier="iron" />;
    case 'listen':
      return <ListenIcon size={size} className={tone} />;
    case 'write':
      return <WriteIcon size={size} className={tone} />;
    case 'quiz':
      return <QuizIcon size={size} className={tone} />;
    case 'path':
      return <PathFlagIcon size={size} className={tone} />;
  }
}
