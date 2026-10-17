import { useId } from 'react';

import { getMascotAccessories } from '../../../lib/mascot/accessories';
import { EXPRESSION_CONFIG, legacyMoodToExpression, resolveExpression } from '../../../lib/mascot/expressions';
import type { MascotExpression } from '../../../lib/mascot/types';
import {
  ARM_LEFT_PATH,
  ARM_RIGHT_PATH,
  BODY_PATH,
  BODY_SHINE_PATH,
  EYE_HAPPY_LEFT,
  EYE_HAPPY_RIGHT,
  EYE_LEFT,
  EYE_RIGHT,
  LEAF_VEIN_PATH,
  LEG_LEFT_PATH,
  LEG_RIGHT_PATH,
  PIX_BROW,
  PIX_CHEEK,
  PIX_GREEN,
  PIX_GREEN_DARK,
  PIX_GREEN_MID,
  PIX_GREEN_SHADOW,
  PLAY_TRIANGLE,
  TIP_FOLD_PATH,
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

/** Vector Pix — anatomical groups for CSS idle (breathe / blink / arms). */
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
  /* Correct/wrong: part-level CSS only, no particle FX overlay. */
  const showFx = reactive && resolvedExpr !== 'happy' && resolvedExpr !== 'wrong';

  const cls = [
    'scanplay-mascot',
    'scanplay-mascot--svg',
    `scanplay-mascot--${resolvedExpr}`,
    `sp-eyes--${cfg.eyes}`,
    cfg.brows && cfg.brows !== 'none' ? `sp-brows--${cfg.brows}` : '',
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
        height: size * 1.15,
        ['--sp-tilt' as string]: `${cfg.tilt ?? 0}deg`,
      }}
      aria-hidden={!label}
    >
      {showFx && (
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
          <linearGradient id={`${uid}-body`} x1="28%" y1="8%" x2="72%" y2="96%">
            <stop offset="0%" stopColor="#9BE85A" />
            <stop offset="45%" stopColor={PIX_GREEN} />
            <stop offset="100%" stopColor={PIX_GREEN_DARK} />
          </linearGradient>
          <linearGradient id={`${uid}-shine`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
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

        <g id="mascot-root" className="sp-mascot-root">
          {/* Arms behind body so only the outer limb shows (idle hang). */}
          <g id="mascot-arm-left" className={`sp-arm sp-arm--left sp-limbs--${cfg.armPose ?? 'neutral'}`}>
            <path d={ARM_LEFT_PATH} fill={PIX_GREEN_MID} stroke={PIX_GREEN_SHADOW} strokeWidth="1" />
          </g>
          <g id="mascot-arm-right" className={`sp-arm sp-arm--right sp-limbs--${cfg.armPose ?? 'neutral'}`}>
            <path d={ARM_RIGHT_PATH} fill={PIX_GREEN_MID} stroke={PIX_GREEN_SHADOW} strokeWidth="1" />
          </g>

          <g id="mascot-leg-left" className="sp-leg sp-leg--left">
            <path d={LEG_LEFT_PATH} fill={PIX_GREEN_DARK} stroke={PIX_GREEN_SHADOW} strokeWidth="1" />
          </g>
          <g id="mascot-leg-right" className="sp-leg sp-leg--right">
            <path d={LEG_RIGHT_PATH} fill={PIX_GREEN_DARK} stroke={PIX_GREEN_SHADOW} strokeWidth="1" />
          </g>

          {/* Breath wrapper: body + face move together; keeps existing .sp-body-group hook */}
          <g className="sp-body-group">
            <g id="mascot-body" className="sp-body">
              <path d={BODY_PATH} fill={`url(#${uid}-body)`} stroke={PIX_GREEN_SHADOW} strokeWidth="1.5" />
              <path d={TIP_FOLD_PATH} fill={PIX_GREEN_DARK} opacity="0.85" />
              <path className="sp-body-shine" d={BODY_SHINE_PATH} fill={`url(#${uid}-shine)`} />
              <path
                className="sp-leaf-vein"
                d={LEAF_VEIN_PATH}
                stroke={PIX_GREEN_MID}
                strokeWidth="1.4"
                opacity="0.4"
                fill="none"
                strokeLinecap="round"
              />
            </g>

            <g id="mascot-head" className="sp-head">
              <path
                className="sp-brow sp-brow--left"
                d="M 32 36 Q 38 30 46 36"
                fill="none"
                stroke={PIX_BROW}
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              <path
                className="sp-brow sp-brow--right"
                d="M 74 36 Q 80 30 88 36"
                fill="none"
                stroke={PIX_BROW}
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              <ellipse cx="30" cy="58" rx="8" ry="5" fill={PIX_CHEEK} opacity="0.55" />
              <ellipse cx="90" cy="58" rx="8" ry="5" fill={PIX_CHEEK} opacity="0.55" />
            </g>

            {/* Glossy black eyes (happy.png). White sclera from the sheet is deferred for look-around. */}
            <g id="mascot-eye-left" className="sp-eye sp-eye--left">
              <circle cx={EYE_LEFT.cx} cy={EYE_LEFT.cy} r={EYE_LEFT.r} fill="#0f172a" />
            </g>
            <g id="mascot-eye-right" className="sp-eye sp-eye--right">
              <circle cx={EYE_RIGHT.cx} cy={EYE_RIGHT.cy} r={EYE_RIGHT.r} fill="#0f172a" />
            </g>

            <g id="mascot-pupil-left" className="sp-pupil sp-pupil--left">
              <circle cx={EYE_LEFT.cx - 3} cy={EYE_LEFT.cy - 3.5} r="3.2" fill="#fff" />
              <circle cx={EYE_LEFT.cx + 3.5} cy={EYE_LEFT.cy + 3} r="1.4" fill="#fff" opacity="0.9" />
            </g>
            <g id="mascot-pupil-right" className="sp-pupil sp-pupil--right">
              <circle cx={EYE_RIGHT.cx - 3} cy={EYE_RIGHT.cy - 3.5} r="3.2" fill="#fff" />
              <circle cx={EYE_RIGHT.cx + 3.5} cy={EYE_RIGHT.cy + 3} r="1.4" fill="#fff" opacity="0.9" />
            </g>

            {/* Content ^ ^ arcs — shown via opacity during correct (happy-closed). */}
            <g id="mascot-eye-happy-left" className="sp-eye-happy sp-eye-happy--left" aria-hidden="true">
              <path
                d={EYE_HAPPY_LEFT}
                fill="none"
                stroke="#0f172a"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
            </g>
            <g id="mascot-eye-happy-right" className="sp-eye-happy sp-eye-happy--right" aria-hidden="true">
              <path
                d={EYE_HAPPY_RIGHT}
                fill="none"
                stroke="#0f172a"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
            </g>

            {/* Green lids cover eyes on blink (scaleY from top). */}
            <g id="mascot-eyelid-left" className="sp-eyelid sp-eyelid--left">
              <ellipse cx={EYE_LEFT.cx} cy={EYE_LEFT.cy} rx={EYE_LEFT.r + 0.5} ry={EYE_LEFT.r + 0.5} fill={PIX_GREEN} />
            </g>
            <g id="mascot-eyelid-right" className="sp-eyelid sp-eyelid--right">
              <ellipse cx={EYE_RIGHT.cx} cy={EYE_RIGHT.cy} rx={EYE_RIGHT.r + 0.5} ry={EYE_RIGHT.r + 0.5} fill={PIX_GREEN} />
            </g>

            <g id="mascot-mouth" className="sp-mouth-group">
              {mouth.fill ? (
                <path className="sp-mouth" d={mouth.d} fill={mouth.fill} />
              ) : (
                <path
                  className="sp-mouth"
                  d={mouth.d}
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth={mouth.strokeWidth ?? 2.8}
                  strokeLinecap="round"
                />
              )}
            </g>

            <g id="mascot-accessory" className="sp-accessory">
              <path d={PLAY_TRIANGLE} fill="#fff" fillOpacity="0.92" />
              {accessories.includes('cap') && (
                <path d="M 30 18 Q 60 2 90 18 L 92 24 Q 60 12 28 24 Z" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1.5" />
              )}
              {accessories.includes('crown') && (
                <path d="M 34 16 L 40 4 L 48 14 L 60 0 L 72 14 L 80 4 L 86 16 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
              )}
            </g>
          </g>

          {cfg.prop === 'torch' && (
            <g className="sp-torch" aria-hidden="true">
              <rect x="78" y="58" width="6" height="22" rx="2" fill="#92400e" stroke="#78350f" strokeWidth="1" />
              <ellipse className="sp-torch-flame" cx="81" cy="50" rx="9" ry="14" fill={`url(#${uid}-flame)`} />
              <ellipse className="sp-torch-flame sp-torch-flame--core" cx="81" cy="54" rx="4.5" ry="8" fill="#fef08a" opacity="0.9" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
