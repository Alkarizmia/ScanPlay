import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { Logo } from './Logo';
import { LockIcon } from './icons/LockIcon';
import { PathGameKindIcon, pathGameKind } from './icons/PathGameIcons';

import { buildPathD, buildPathSteps, pathAreaHeight } from '../lib/pathSteps';
import {
  getNextGameForStep,
  getNodeGamesDone,
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
import { StreakFlame } from './icons/StreakFlame';
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
  deckId?: string | null;
  onReward?: () => void;
  onNewUnlocks?: (unlocks: import('../lib/achievements').AchievementDef[]) => void;
}

const TIER_CLASS: Record<StepTier, string> = {
  gold: 'tier-gold',
  iron: 'tier-iron',
  bronze: 'tier-bronze',
};

type RecenterDir = 'up' | 'down' | null;

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const oy = style.overflowY;
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && node.scrollHeight > node.clientHeight + 4) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

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
  onReward: _onReward,
  onNewUnlocks: _onNewUnlocks,
}: GamePathProps) {
  void _onReward;
  void _onNewUnlocks;

  const pathSteps = useMemo(
    () => buildPathSteps(pathStepCount, pairs),
    [pathStepCount, pairs],
  );
  const pathD = useMemo(() => buildPathD(pathSteps), [pathSteps]);
  const areaHeight = pathAreaHeight(pathSteps.length);

  const firstActiveIdx = getFirstActiveStep(stepProgress, pathStepCount, examMode, pairs);

  const activeNode = pathSteps.find((step) => step.kind === 'game' && step.id === firstActiveIdx);
  const activeGames = activeNode && activeNode.kind === 'game'
    ? getNodeGamesDone(activeNode.id, stepProgress, pairs)
    : null;

  const [unlockIdx, setUnlockIdx] = useState<number | null>(null);
  const [recenterDir, setRecenterDir] = useState<RecenterDir>(null);
  const prevActiveRef = useRef(firstActiveIdx);
  const pathRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const getActiveButton = useCallback((): HTMLElement | null => {
    return pathRef.current?.querySelector<HTMLElement>('.scanplay-node.active') ?? null;
  }, []);

  const scrollToActive = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const node = getActiveButton();
      const scroller = findScrollParent(rootRef.current);
      if (!node) return;
      if (!scroller) {
        node.scrollIntoView({ behavior, block: 'center' });
        return;
      }
      const scrollerRect = scroller.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const nodeCenter = nodeRect.top + nodeRect.height / 2;
      const viewCenter = scrollerRect.top + scroller.clientHeight / 2;
      const nextTop = scroller.scrollTop + (nodeCenter - viewCenter);
      scroller.scrollTo({ top: Math.max(0, nextTop), behavior });
    },
    [getActiveButton],
  );

  const updateRecenterHint = useCallback(() => {
    const node = getActiveButton();
    const scroller = findScrollParent(rootRef.current);
    if (!node || !scroller) {
      setRecenterDir(null);
      return;
    }
    const sRect = scroller.getBoundingClientRect();
    const nRect = node.getBoundingClientRect();
    const margin = Math.min(120, scroller.clientHeight * 0.22);
    if (nRect.bottom < sRect.top + margin) {
      setRecenterDir('up');
      return;
    }
    if (nRect.top > sRect.bottom - margin) {
      setRecenterDir('down');
      return;
    }
    setRecenterDir(null);
  }, [getActiveButton]);

  useEffect(() => {
    if (firstActiveIdx > prevActiveRef.current && firstActiveIdx < pathStepCount) {
      setUnlockIdx(firstActiveIdx);
      playSound('pop');
      const timer = window.setTimeout(() => setUnlockIdx(null), 750);
      prevActiveRef.current = firstActiveIdx;
      return () => window.clearTimeout(timer);
    }
    prevActiveRef.current = firstActiveIdx;
  }, [firstActiveIdx, pathStepCount]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      scrollToActive('smooth');
      window.setTimeout(updateRecenterHint, 320);
    });
    return () => window.cancelAnimationFrame(id);
  }, [firstActiveIdx, areaHeight, scrollToActive, updateRecenterHint]);

  useEffect(() => {
    const scroller = findScrollParent(rootRef.current);
    if (!scroller) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        updateRecenterHint();
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateRecenterHint();
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [updateRecenterHint, areaHeight]);

  return (
    <div className="scanplay-path" ref={rootRef}>
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
            {pathStepCount} {t('pathUnitSteps', locale)}
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
          if (step.kind !== 'game') return null;

          const result = getStepResult(step.id, stepProgress);
          const displayTier = getDisplayTierFromResult(result);
          const active = isStepActive(step.id, stepProgress, pathStepCount, examMode, pairs);
          const locked = isStepLocked(step.id, stepProgress, pathStepCount, examMode, pairs);
          const unlocking = unlockIdx === step.id;
          const tierClass = displayTier ? TIER_CLASS[displayTier] : '';
          const { done, total } = getNodeGamesDone(step.id, stepProgress, pairs);
          const complete = !locked && total > 0 && done >= total;
          const glowLevel =
            locked || complete ? 0 : Math.min(3, Math.ceil((done / Math.max(total, 1)) * 3));
          const nextMode =
            getNextGameForStep(step.id, stepProgress, pairs) ?? step.games[0] ?? 'quiz';
          const kind = pathGameKind(nextMode);
          const fireTier = complete ? displayTier ?? 'bronze' : null;
          const showFraction = !locked && !complete && total > 0;
          const examCleared = examMode && result && result.pct >= EXAM_PASS_PCT;
          const canOpen =
            (historyReplay || !complete) &&
            canPlayStep(step.id, stepProgress, {
              historyReplay,
              examMode,
              totalSteps: pathStepCount,
              pairs,
            });

          return (
            <div
              key={step.id}
              className={`scanplay-path-step${step.x > 50 ? ' scanplay-path-step--right' : ''}`}
              style={{ left: `${step.x}%`, top: `${step.y}%` } as CSSProperties}
            >
              <button
                type="button"
                className={`scanplay-node ${tierClass} ${result ? 'has-result' : ''} ${active ? 'active' : ''} ${locked ? 'locked' : ''} ${unlocking ? 'unlocking' : ''} ${glowLevel ? `glow-${glowLevel}` : ''} ${fireTier ? `lit lit-${fireTier}` : ''}`}
                onClick={() => {
                  if (!canOpen) return;
                  const next = getNextGameForStep(step.id, stepProgress, pairs) ?? step.games[0];
                  onSelect(step.id, next);
                }}
                disabled={!canOpen}
                aria-label={t('pathNodeLabel', locale).replace('{n}', String(step.id + 1))}
                title={!locked && !complete ? `${done}/${total}` : undefined}
              >
                {fireTier && (
                  <span className="scanplay-node-flames" aria-hidden="true">
                    <StreakFlame lit size={16} className="scanplay-node-flame scanplay-node-flame--l" />
                    <StreakFlame lit size={22} className="scanplay-node-flame scanplay-node-flame--c" />
                    <StreakFlame lit size={16} className="scanplay-node-flame scanplay-node-flame--r" />
                  </span>
                )}
                <span className="scanplay-node-icon" aria-hidden="true">
                  {locked ? (
                    <LockIcon size={30} />
                  ) : (
                    <PathGameKindIcon kind={kind} size={30} />
                  )}
                </span>
                {showFraction && (
                  <span className="scanplay-node-pct scanplay-node-pct--games">
                    {examCleared ? '✓' : `${done}/${total}`}
                  </span>
                )}
                {fireTier === 'gold' && <span className="scanplay-node-star">★</span>}
              </button>
            </div>
          );
        })}
      </div>

      {recenterDir && (
        <button
          type="button"
          className={`scanplay-path-recenter scanplay-path-recenter--${recenterDir}`}
          onClick={() => {
            scrollToActive('smooth');
            window.setTimeout(updateRecenterHint, 380);
          }}
          aria-label={t('pathRecenterActive', locale)}
        >
          <span className="scanplay-path-recenter-icon" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
