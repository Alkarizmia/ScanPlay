import { useId } from 'react';

import { getMascotAccessories } from '../../../lib/mascot/accessories';
import { EXPRESSION_CONFIG, legacyMoodToExpression, resolveExpression } from '../../../lib/mascot/expressions';
import type { MascotExpression } from '../../../lib/mascot/types';
import {
  BODY_PATH,
  BODY_SHINE_PATH,
  EYE_LEFT,
  EYE_RIGHT,
  LEAF_VEIN_PATH,
  PLAY_CIRCLE,
  PLAY_TRIANGLE,
  VIEWBOX,
} from './paths';

export interface ScanPlayMascotSvgProps {
  expression?: MascotExpression | string;
  size?: number;
  idle?: boolean;
  celebrate?: boolean;
  level?: number;
  className?: string;
  label?: string;
}

/** Vector fallback — crisp at any size when PNG asset unavailable. */
export function ScanPlayMascotSvg({
  expression = 'happy',
  size = 72,
  idle = true,
  celebrate = false,
  level = 1,
  className = '',
  label = 'ScanPlay',
}: ScanPlayMascotSvgProps) {
  const uid = useId().replace(/:/g, '');
  const resolvedExpr: MascotExpression =
    expression in EXPRESSION_CONFIG
      ? (expression as MascotExpression)
      : legacyMoodToExpression(expression);
  const cfg = resolveExpression(resolvedExpr);
  const accessories = getMascotAccessories(level);
  const mouth = cfg.mouth;
  const reactive =
    celebrate ||
    ['streak', 'celebrating', 'levelup', 'combo', 'chest', 'badge', 'excited', 'jumping', 'applauding'].includes(
      resolvedExpr,
    );

  const cls = [
    'scanplay-mascot',
    'scanplay-mascot--svg',
    `scanplay-mascot--${resolvedExpr}`,
    idle ? 'scanplay-mascot--idle' : '',
    celebrate ? 'scanplay-mascot--celebrate' : '',
    reactive ? 'scanplay-mascot--reactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      style={{
        width: size,
        height: size * 1.1,
        ['--sp-tilt' as string]: `${cfg.tilt ?? 0}deg`,
      }}
      aria-hidden={!label}
    >
      {(reactive || celebrate) && (
        <span className="sp-mascot-fx" aria-hidden="true">
          <i className="sp-fx-ring" />
          <i className="sp-fx-p sp-fx-p--1" />
          <i className="sp-fx-p sp-fx-p--2" />
          <i className="sp-fx-p sp-fx-p--3" />
          <i className="sp-fx-p sp-fx-p--4" />
          <i className="sp-fx-p sp-fx-p--5" />
          <i className="sp-fx-p sp-fx-p--6" />
        </span>
      )}
      <svg viewBox={VIEWBOX} className="sp-svg" role="img" aria-label={label}>
        <defs>
          <linearGradient id={`${uid}-body`} x1="22%" y1="0%" x2="78%" y2="100%">
            <stop offset="0%" stopColor="#a3e635" />
            <stop offset="40%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
          <linearGradient id={`${uid}-shine`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${uid}-flame`} cx="50%" cy="70%" r="60%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="45%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0.85" />
          </radialGradient>
        </defs>

        {(cfg.fx === 'sparkle' || cfg.fx === 'confetti' || cfg.fx === 'glow') && (
          <g className="sp-svg-fx" aria-hidden="true">
            <circle className="sp-spark sp-spark--1" cx="18" cy="28" r="2.2" fill="#fbbf24" />
            <circle className="sp-spark sp-spark--2" cx="102" cy="34" r="1.8" fill="#f97316" />
            <circle className="sp-spark sp-spark--3" cx="14" cy="72" r="1.6" fill="#4ade80" />
            <circle className="sp-spark sp-spark--1" cx="106" cy="78" r="2" fill="#fde047" />
            {cfg.fx === 'confetti' && (
              <>
                <rect className="sp-confetti" x="22" y="18" width="4" height="6" rx="1" fill="#f97316" transform="rotate(-18 24 21)" />
                <rect className="sp-confetti" x="94" y="20" width="4" height="6" rx="1" fill="#22c55e" transform="rotate(22 96 23)" />
                <rect className="sp-confetti" x="28" y="96" width="4" height="5" rx="1" fill="#3b82f6" transform="rotate(-12 30 98)" />
              </>
            )}
          </g>
        )}

        <g className="sp-body-group">
          <path className="sp-body" d={BODY_PATH} fill={`url(#${uid}-body)`} stroke="#166534" strokeWidth="2" />
          <path className="sp-body-shine" d={BODY_SHINE_PATH} fill={`url(#${uid}-shine)`} />
          <path className="sp-leaf-vein" d={LEAF_VEIN_PATH} stroke="#22c55e" strokeWidth="1.2" opacity="0.35" fill="none" />

          <circle cx={PLAY_CIRCLE.cx} cy={PLAY_CIRCLE.cy} r={PLAY_CIRCLE.r} fill="#fff" />
          <polygon points={PLAY_TRIANGLE} fill="#16a34a" />

          <ellipse className="sp-eye sp-eye--left" cx={EYE_LEFT.cx} cy={EYE_LEFT.cy} rx="8" ry="10" fill="#fff" stroke="#1e293b" strokeWidth="2" />
          <ellipse className="sp-eye sp-eye--right" cx={EYE_RIGHT.cx} cy={EYE_RIGHT.cy} rx="8" ry="10" fill="#fff" stroke="#1e293b" strokeWidth="2" />
          <circle className="sp-pupil" cx={EYE_LEFT.cx + 1} cy={EYE_LEFT.cy + 1} r="3.5" fill="#1e293b" />
          <circle className="sp-pupil" cx={EYE_RIGHT.cx - 1} cy={EYE_RIGHT.cy + 1} r="3.5" fill="#1e293b" />
          <circle cx={EYE_LEFT.cx + 2} cy={EYE_LEFT.cy - 2} r="1.3" fill="#fff" />
          <circle cx={EYE_RIGHT.cx + 2} cy={EYE_RIGHT.cy - 2} r="1.3" fill="#fff" />

          {mouth.fill ? (
            <path className="sp-mouth" d={mouth.d} fill={mouth.fill} />
          ) : (
            <path
              className="sp-mouth"
              d={mouth.d}
              fill="none"
              stroke="#1e293b"
              strokeWidth={mouth.strokeWidth ?? 2.5}
              strokeLinecap="round"
            />
          )}
        </g>

        <g className={`sp-limbs sp-limbs--${cfg.armPose ?? 'neutral'}`}>
          <path className="sp-arm sp-arm--left" d="M 22 62 Q 10 58 8 48" fill="none" stroke="#22c55e" strokeWidth="8" strokeLinecap="round" />
          <path className="sp-arm sp-arm--right" d="M 98 62 Q 110 58 112 48" fill="none" stroke="#22c55e" strokeWidth="8" strokeLinecap="round" />
          <path className="sp-leg sp-leg--left" d="M 46 112 Q 42 122 40 126" fill="none" stroke="#16a34a" strokeWidth="8" strokeLinecap="round" />
          <path className="sp-leg sp-leg--right" d="M 74 112 Q 78 122 80 126" fill="none" stroke="#16a34a" strokeWidth="8" strokeLinecap="round" />
        </g>

        {cfg.prop === 'torch' && (
          <g className="sp-torch" aria-hidden="true">
            <rect x="78" y="58" width="6" height="22" rx="2" fill="#92400e" stroke="#78350f" strokeWidth="1" />
            <ellipse className="sp-torch-flame" cx="81" cy="50" rx="9" ry="14" fill={`url(#${uid}-flame)`} />
            <ellipse className="sp-torch-flame sp-torch-flame--core" cx="81" cy="54" rx="4.5" ry="8" fill="#fef08a" opacity="0.9" />
          </g>
        )}

        {accessories.includes('cap') && (
          <path d="M 30 26 Q 60 10 90 26 L 92 32 Q 60 20 28 32 Z" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1.5" />
        )}
        {accessories.includes('crown') && (
          <path d="M 34 24 L 40 12 L 48 22 L 60 8 L 72 22 L 80 12 L 86 24 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
        )}
      </svg>
    </div>
  );
}
