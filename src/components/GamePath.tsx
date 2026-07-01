import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { Logo } from './Logo';

import { buildPathD, buildPathSteps, pathAreaHeight } from '../lib/pathSteps';

import {

  getNextGameForStep,

  getNodeGamesDone,

  getNodeProgressFraction,

} from '../lib/pathGamePlan';

import type { WordPair } from '../types';

import {

  canPlayStep,

  EXAM_PASS_PCT,

  getFirstActiveStep,

  getStepResult,

  getDisplayTierFromResult,

  isStepActive,

  isStepLocked,

} from '../lib/stepProgress';

import { playSound } from '../lib/sounds';

import { t } from '../lib/i18n';

import type { GameMode, Locale, StepProgressMap, StepTier } from '../types';



interface GamePathProps {

  locale: Locale;

  wordCount: number;

  pairs: WordPair[];

  pathStepCount: number;

  onSelect: (stepIndex: number, mode: GameMode) => void;

  stepProgress?: StepProgressMap;

  historyReplay?: boolean;

  examMode?: boolean;

  sheetThumbnail?: string;

}



const TIER_CLASS: Record<StepTier, string> = {

  gold: 'tier-gold',

  iron: 'tier-iron',

  bronze: 'tier-bronze',

};



export function GamePath({

  locale,

  wordCount,

  pairs,

  pathStepCount,

  onSelect,

  stepProgress = {},

  historyReplay = false,

  examMode = false,

  sheetThumbnail,

}: GamePathProps) {

  const pathSteps = useMemo(() => buildPathSteps(pathStepCount, pairs), [pathStepCount, pairs]);

  const pathD = useMemo(() => buildPathD(pathSteps), [pathSteps]);

  const areaHeight = pathAreaHeight(pathStepCount);



  const firstActiveIdx = getFirstActiveStep(stepProgress, pathStepCount, examMode, pairs);

  const activeNode = pathSteps[firstActiveIdx];

  const activeGames = activeNode ? getNodeGamesDone(firstActiveIdx, stepProgress, pairs) : null;



  const [unlockIdx, setUnlockIdx] = useState<number | null>(null);

  const prevActiveRef = useRef(firstActiveIdx);

  const pathRef = useRef<HTMLDivElement>(null);



  useEffect(() => {

    if (firstActiveIdx > prevActiveRef.current && firstActiveIdx < pathSteps.length) {

      setUnlockIdx(firstActiveIdx);

      playSound('pop');

      const timer = window.setTimeout(() => setUnlockIdx(null), 750);

      prevActiveRef.current = firstActiveIdx;

      return () => window.clearTimeout(timer);

    }

    prevActiveRef.current = firstActiveIdx;

  }, [firstActiveIdx, pathSteps.length]);



  useEffect(() => {

    const node = pathRef.current?.querySelector('.scanplay-node.active');

    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  }, [firstActiveIdx]);



  return (

    <div className="scanplay-path">

      <div className="scanplay-unit-banner">

        <div className="unit-banner-sheet" aria-hidden="true">

          {sheetThumbnail ? (

            <img src={sheetThumbnail} alt="" className="unit-banner-thumb" />

          ) : (

            <Logo size={36} />

          )}

        </div>

        <div className="unit-banner-text">

          <span className="unit-banner-tag">{t('pathUnitTag', locale)}</span>

          <h3 className="unit-banner-title">

            {wordCount} {t('pathUnitWords', locale)}

          </h3>

          <p className="unit-banner-sub">

            {pathSteps.length} {t('pathUnitSteps', locale)}

          </p>

          {activeNode && activeGames && (

            <p className="unit-banner-mode">

              {t('pathNodeGoal', locale)

                .replace('{done}', String(activeGames.done))

                .replace('{total}', String(activeGames.total))}

            </p>

          )}

        </div>

      </div>



      <div className="path-tier-legend">
        <span className="path-tier-chip tier-gold">★ {t('tierGoldPct', locale)}</span>
        <span className="path-tier-chip tier-iron">⚙ {t('tierIronPct', locale)}</span>
        <span className="path-tier-chip tier-bronze">🥉 {t('tierBronzePct', locale)}</span>
      </div>



      <div

        ref={pathRef}

        className="scanplay-path-area"

        style={{ '--path-height': `${areaHeight}px` } as CSSProperties}

      >

        <svg

          className="scanplay-path-line"

          viewBox="0 0 100 100"

          preserveAspectRatio="none"

          aria-hidden="true"

        >

          <path

            d={pathD}

            fill="none"

            stroke="currentColor"

            strokeWidth="2.8"

            strokeLinecap="round"

            strokeDasharray="3 7"

            vectorEffect="non-scaling-stroke"

          />

        </svg>



        {pathSteps.map((step) => {

          const result = getStepResult(step.id, stepProgress);
          const displayTier = getDisplayTierFromResult(result);

          const active = isStepActive(step.id, stepProgress, pathStepCount, examMode, pairs);

          const locked = isStepLocked(step.id, stepProgress, pathStepCount, examMode, pairs);

          const playable = canPlayStep(step.id, stepProgress, {

            historyReplay,

            examMode,

            totalSteps: pathStepCount,

            pairs,

          });

          const unlocking = unlockIdx === step.id;

          const tierClass = displayTier ? TIER_CLASS[displayTier] : '';

          const progressFrac = getNodeProgressFraction(step.id, stepProgress, pairs);

          const progressPct = Math.round(progressFrac * 100);

          const { done, total } = getNodeGamesDone(step.id, stepProgress, pairs);



          return (

            <div

              key={step.id}

              className={`scanplay-path-step${step.x > 50 ? ' scanplay-path-step--right' : ''}`}

              style={{ left: `${step.x}%`, top: `${step.y}%` } as CSSProperties}

            >

              <button

                type="button"

                className={`scanplay-node ${tierClass} ${result ? 'has-result' : ''} ${active ? 'active' : ''} ${locked ? 'locked' : ''} ${unlocking ? 'unlocking' : ''} ${progressPct > 0 && progressPct < 100 ? 'in-progress' : ''}`}

                onClick={() => {

                  if (!playable) return;

                  const next =

                    getNextGameForStep(step.id, stepProgress, pairs) ?? step.games[0];

                  onSelect(step.id, next);

                }}

                disabled={!playable}

                aria-label={t('pathNodeLabel', locale).replace('{n}', String(step.id + 1))}

                title={result ? `${done}/${total}` : undefined}

              >
                <span className="scanplay-node-icon" aria-hidden="true">
                  {locked
                    ? '🔒'
                    : displayTier === 'gold'
                      ? '★'
                      : displayTier === 'iron'
                        ? '⚙'
                        : displayTier === 'bronze'
                          ? '🥉'
                          : '⭐'}
                </span>
                {result && progressPct > 0 && progressPct < 100 && (
                  <span className="scanplay-node-pct scanplay-node-pct--games">{done}/{total}</span>
                )}
                {displayTier === 'gold' && <span className="scanplay-node-star">★</span>}
                {displayTier && displayTier !== 'gold' && progressPct >= 100 && (
                  <span className={`scanplay-node-pct scanplay-node-pct--score scanplay-node-pct--${displayTier}`}>
                    {examMode && result!.pct >= EXAM_PASS_PCT ? '✓' : `${result!.pct}%`}
                  </span>
                )}
                {locked && <span className="scanplay-node-lock" aria-hidden="true">🔒</span>}
              </button>



              {active && (

                <div className="scanplay-orbit" aria-hidden="true">

                  <div className="scanplay-orbit-track">

                    <div className="scanplay-path-buddy">

                      <Logo size={40} />

                    </div>

                  </div>

                </div>

              )}

            </div>

          );

        })}

      </div>

    </div>

  );

}

