import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { DailyChestOverlay } from './DailyChestOverlay';
import { Logo } from './Logo';
import { LockIcon } from './icons/LockIcon';
import { PathGameKindIcon, pathGameKind } from './icons/PathGameIcons';
import { ScanPlayChest } from './ScanPlayChest';

import { buildPathD, buildPathSteps, pathAreaHeight } from '../lib/pathSteps';
import {
  getNextGameForStep,
  getNodeGamesDone,
} from '../lib/pathGamePlan';
import { claimPathTestChest, isPathTestChestOpened, PATH_TEST_CHEST_AFTER_STEP } from '../lib/pathChest';
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
  deckId = null,
  onReward,
}: GamePathProps) {
  const pathSteps = useMemo(
    () => buildPathSteps(pathStepCount, pairs, { testChest: !examMode }),
    [pathStepCount, pairs, examMode],
  );
  const pathD = useMemo(() => buildPathD(pathSteps), [pathSteps]);
  const areaHeight = pathAreaHeight(pathSteps.length);

  const firstActiveIdx = getFirstActiveStep(stepProgress, pathStepCount, examMode, pairs);
  const [chestOpened, setChestOpened] = useState(() => isPathTestChestOpened(deckId));
  const [chestOverlayOpen, setChestOverlayOpen] = useState(false);

  useEffect(() => {
    setChestOpened(isPathTestChestOpened(deckId));
  }, [deckId]);

  const chestPending = !examMode && firstActiveIdx > PATH_TEST_CHEST_AFTER_STEP && !chestOpened;
  const chestBlocksLater = chestPending;

  const activeNode = pathSteps.find((step) => step.kind === 'game' && step.id === firstActiveIdx);
  const activeGames = activeNode && activeNode.kind === 'game'
    ? getNodeGamesDone(activeNode.id, stepProgress, pairs)
    : null;

  const [unlockIdx, setUnlockIdx] = useState<number | null>(null);
  const prevActiveRef = useRef(firstActiveIdx);
  const pathRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (firstActiveIdx > prevActiveRef.current && firstActiveIdx < pathStepCount && !chestPending) {
      setUnlockIdx(firstActiveIdx);
      playSound('pop');
      const timer = window.setTimeout(() => setUnlockIdx(null), 750);
      prevActiveRef.current = firstActiveIdx;
      return () => window.clearTimeout(timer);
    }
    prevActiveRef.current = firstActiveIdx;
  }, [firstActiveIdx, pathStepCount, chestPending]);

  useEffect(() => {
    const node = pathRef.current?.querySelector('.scanplay-node.active');
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [firstActiveIdx, chestPending]);

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
          if (step.kind === 'chest') {
            const locked = firstActiveIdx <= PATH_TEST_CHEST_AFTER_STEP;
            const active = chestPending && !locked;
            return (
              <div
                key={step.chestId}
                className={`scanplay-path-step${step.x > 50 ? ' scanplay-path-step--right' : ''}`}
                style={{ left: `${step.x}%`, top: `${step.y}%` } as CSSProperties}
              >
                <button
                  type="button"
                  className={`scanplay-node chest${active ? ' active' : ''}${locked ? ' locked' : ''}${chestOpened ? ' chest-opened' : ''}`}
                  onClick={() => {
                    if (locked || chestOpened) return;
                    setChestOverlayOpen(true);
                  }}
                  disabled={locked || chestOpened}
                  aria-label={t('shopDailyChest', locale)}
                >
                  <span className="scanplay-node-icon" aria-hidden="true">
                    {locked ? <LockIcon size={30} /> : <ScanPlayChest open={chestOpened} size={44} />}
                  </span>
                </button>
              </div>
            );
          }

          const result = getStepResult(step.id, stepProgress);
          const displayTier = getDisplayTierFromResult(result);
          const blockedByChest = chestBlocksLater && step.id > PATH_TEST_CHEST_AFTER_STEP;
          const active =
            !blockedByChest && isStepActive(step.id, stepProgress, pathStepCount, examMode, pairs);
          const locked =
            blockedByChest || isStepLocked(step.id, stepProgress, pathStepCount, examMode, pairs);
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
            !blockedByChest &&
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

      <DailyChestOverlay
        open={chestOverlayOpen}
        locale={locale}
        onClose={() => setChestOverlayOpen(false)}
        claim={(rarity) => claimPathTestChest(deckId, rarity)}
        onOpened={() => {
          setChestOpened(true);
          setUnlockIdx(PATH_TEST_CHEST_AFTER_STEP + 1);
          playSound('pop');
          window.setTimeout(() => setUnlockIdx(null), 750);
          onReward?.();
        }}
      />
    </div>
  );
}
