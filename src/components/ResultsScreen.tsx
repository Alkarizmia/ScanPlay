import { useEffect, useState, type CSSProperties } from 'react';

import { LearningFlow } from './LearningFlow';
import { Mascot } from './Mascot';
import { NotificationCenter } from './NotificationCenter';
import type { AchievementDef } from '../lib/achievements';
import { getGamification, getLevel, xpForNextLevel } from '../lib/gamification';
import { t } from '../lib/i18n';
import { isTechnicalResult } from '../lib/stepProgress';
import type { GameMode, Locale, SessionResult, StepTier } from '../types';

interface ResultsScreenProps {
  locale: Locale;
  result: SessionResult;
  bestScore: number;
  pathComplete: boolean;
  stepsDone: number;
  stepsTotal: number;
  xpBefore: number;
  newUnlocks: AchievementDef[];
  refreshKey: number;
  onSocialChange?: () => void;
  examFailed?: boolean;
  onContinue: () => void;
  onReplay: () => void;
  onHome: () => void;
}

const MODE_KEYS: Record<GameMode, 'flashcards' | 'quiz' | 'match' | 'modeType' | 'modeSpeak' | 'modeListen' | 'modeTrueFalse' | 'modeCloze'> = {
  flashcards: 'flashcards',
  quiz: 'quiz',
  match: 'match',
  type: 'modeType',
  speak: 'modeSpeak',
  listen: 'modeListen',
  truefalse: 'modeTrueFalse',
  cloze: 'modeCloze',
};

const TIER_LABEL: Record<StepTier, 'tierGold' | 'tierIron' | 'tierBronze'> = {
  gold: 'tierGold',
  iron: 'tierIron',
  bronze: 'tierBronze',
};

function getMessageKey(
  pct: number,
  examFailed: boolean,
): 'resultAlmostPerfect' | 'resultGreat' | 'resultGood' | 'resultOk' | 'resultKeep' {
  if (examFailed) return 'resultKeep';
  if (pct === 100) return 'resultAlmostPerfect';
  if (pct >= 90) return 'resultGreat';
  if (pct >= 70) return 'resultGood';
  if (pct >= 50) return 'resultOk';
  return 'resultKeep';
}

export function ResultsScreen({
  locale,
  result,
  bestScore,
  pathComplete,
  stepsDone,
  stepsTotal,
  xpBefore,
  newUnlocks,
  refreshKey,
  onSocialChange,
  examFailed = false,
  onContinue,
  onReplay,
  onHome,
}: ResultsScreenProps) {
  const technical =
    result.technical === true ||
    (result.stepPct != null && isTechnicalResult(result.stepPct));
  const pct = technical ? null : Math.round((result.score / result.total) * 100);
  const isNewBest = !technical && result.score > bestScore;
  const tier = technical ? undefined : result.stepTier;
  const isGold = tier === 'gold';
  const examBlocked = result.examMode === true && result.examPassed === false;
  const canContinue = !pathComplete && !examBlocked;
  const canRetryForGold = !examBlocked && !isGold && !result.goldReplay;
  const showExamRetry = examBlocked;

  const xpAfter = getGamification().xp;
  const level = getLevel(xpAfter);
  const { progress: xpProgress } = xpForNextLevel(xpAfter);

  const [displayXp, setDisplayXp] = useState(xpBefore);
  const [barProgress, setBarProgress] = useState(xpForNextLevel(xpBefore).progress);
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reducedMotion) {
      setDisplayXp(xpAfter);
      setBarProgress(xpProgress);
      return;
    }
    const earned = result.xpEarned ?? 0;
    const start = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const tVal = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - tVal) ** 3;
      setDisplayXp(Math.round(xpBefore + earned * eased));
      setBarProgress(xpForNextLevel(xpBefore + earned * eased).progress);
      if (tVal < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [xpBefore, xpAfter, result.xpEarned, xpProgress, reducedMotion]);

  return (
    <div className="screen results-screen flow-screen">
      <header className="top-bar top-bar-compact results-top-bar">
        <span />
        <NotificationCenter locale={locale} refreshKey={refreshKey} onSocialChange={onSocialChange} />
      </header>

      <main className="results-main scroll-natural">
        <Mascot
          message={
            technical
              ? t('resultTechnical', locale)
              : examFailed
                ? t('examFailed', locale)
                : pathComplete
                  ? t('pathCompleteMsg', locale)
                  : t(getMessageKey(pct ?? 0, examFailed), locale)
          }
          mood={examFailed ? 'sad' : technical || (pct != null && pct >= 70) || pathComplete ? 'excited' : 'happy'}
        />

        <div className="results-card">
        <div className="score-ring" style={{ '--pct': pct ?? 0 } as CSSProperties}>
          <span className={`score-value${technical ? ' score-value--technical' : ''}`}>
            {technical ? '−%' : `${pct}%`}
          </span>
        </div>

        {technical && (
          <p className="results-technical-note">{t('resultTechnicalNote', locale)}</p>
        )}

        {tier && !result.goldReplay && (
          <p className={`results-tier tier-${tier}`}>
            {t(TIER_LABEL[tier], locale)}
            {tier === 'gold' && ' · ' + t('tierGoldLocked', locale)}
            {tier === 'iron' && ' · ' + t('tierIronHint', locale)}
            {tier === 'bronze' && ' · ' + t('tierBronzeHint', locale)}
          </p>
        )}

        {result.goldReplay && (
          <p className="results-tier tier-gold results-replay-kept">
            {t('tierGold', locale)} · {t('resultGoldReplayKept', locale)}
          </p>
        )}

        {technical && result.examMode && (
          <p className="exam-pass-label">{t('resultTechnicalExam', locale)}</p>
        )}

        {result.examMode && !technical && <p className="exam-pass-label">{t('examPassRequired', locale)}</p>}

        <div className="results-xp-block">
          <div className="results-xp-head">
            <span className="results-xp-label">
              {t('resultXpGain', locale)} · Lv.{level}
            </span>
            <span className="results-xp-val animate-pop">
              +{result.xpEarned ?? 0} XP
            </span>
          </div>
          {result.goldReplay && (
            <p className="results-replay-note">{t('resultNoXpReplay', locale)}</p>
          )}
          {technical && (
            <p className="results-replay-note">{t('resultNoXpTechnical', locale)}</p>
          )}
          <div className="xp-bar-track">
            <div
              className="xp-bar-fill"
              style={{ width: `${barProgress}%` }}
            />
          </div>
          <span className="results-xp-total">{displayXp} {t('xp', locale)}</span>
        </div>

        {newUnlocks.length > 0 && (
          <ul className="results-new-achievements">
            {newUnlocks.map((ach) => (
              <li key={ach.id} className="results-ach-chip">
                <span aria-hidden="true">{ach.icon}</span>
                {t(ach.nameKey, locale)}
              </li>
            ))}
          </ul>
        )}

        <p className="results-path-progress">
          {stepsDone}/{stepsTotal} {t('pathUnitSteps', locale)} ({t('tierGold', locale)})
          {examFailed && <span className="exam-fail-note"> · {t('examFailed', locale)}</span>}
        </p>

        <div className="results-stats">
          <div className="stat">
            <span className="stat-val">
              {result.score}/{result.total}
            </span>
            <span className="stat-label">Score</span>
          </div>
          <div className="stat">
            <span className="stat-val">{result.timeSeconds}s</span>
            <span className="stat-label">Time</span>
          </div>
          <div className="stat">
            <span className="stat-val">{t(MODE_KEYS[result.mode], locale)}</span>
            <span className="stat-label">Mode</span>
          </div>
        </div>

        {isNewBest && !examFailed && <p className="new-best">{t('newBest', locale)}</p>}
        {!isNewBest && bestScore > 0 && !technical && (
          <p className="beat-hint">Best: {Math.round((bestScore / result.total) * 100)}%</p>
        )}
      </div>

      <div className="results-actions">
        {pathComplete ? (
          <button type="button" className="btn-primary btn-lg" onClick={onHome}>
            {t('backHome', locale)}
          </button>
        ) : showExamRetry ? (
          <button type="button" className="btn-primary btn-lg" onClick={onReplay}>
            {t('examRetry', locale)}
          </button>
        ) : canContinue ? (
          <button type="button" className="btn-primary btn-lg" onClick={onContinue}>
            {t('continuePath', locale)}
          </button>
        ) : null}
        {canRetryForGold && !showExamRetry && (
          <button type="button" className="btn-secondary" onClick={onReplay}>
            {t('retryForGold', locale)}
          </button>
        )}
        {!pathComplete && (
          <button type="button" className="btn-ghost" onClick={onHome}>
            {t('backHome', locale)}
          </button>
        )}
        </div>

        <LearningFlow active="score" locale={locale} compact />
      </main>
    </div>
  );
}
