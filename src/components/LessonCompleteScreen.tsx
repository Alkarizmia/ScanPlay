import { useEffect, useState } from 'react';
import { getGamification, getLevel, xpForNextLevel } from '../lib/gamification';
import { playSound } from '../lib/sounds';
import { hapticLevelUp } from '../lib/haptics';
import { t } from '../lib/i18n';
import { PixCompanion } from './PixCompanion';
import type { AchievementDef } from '../lib/achievements';
import type { LessonSession, Locale } from '../types';

interface LessonCompleteScreenProps {
  locale: Locale;
  session: LessonSession;
  xpBefore: number;
  newUnlocks: AchievementDef[];
  pathComplete: boolean;
  onContinue: () => void;
  onViewPath: () => void;
  onHome: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function LessonCompleteScreen({
  locale,
  session,
  xpBefore,
  pathComplete,
  onContinue,
  onViewPath,
  onHome,
}: LessonCompleteScreenProps) {
  const totalTime = session.games.reduce((sum, g) => sum + g.timeSeconds, 0);
  const totalScore = session.games.reduce((sum, g) => sum + g.score, 0);
  const totalQuestions = session.games.reduce((sum, g) => sum + g.total, 0);
  const totalXp = session.games.reduce((sum, g) => sum + g.xpEarned, 0);
  const avgPct =
    totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

  const xpAfter = getGamification().xp;
  const levelBefore = getLevel(xpBefore);
  const levelAfter = getLevel(xpAfter);
  const leveledUp = levelAfter > levelBefore;

  const [displayXp, setDisplayXp] = useState(xpBefore);
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (leveledUp) {
      playSound('levelUp');
      hapticLevelUp();
    } else if (totalXp > 0) playSound('xpGain');
    playSound('goalComplete');
  }, [leveledUp, totalXp]);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayXp(xpAfter);
      return;
    }
    const start = performance.now();
    const duration = 1000;
    let frame = 0;
    const tick = (now: number) => {
      const tVal = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - tVal) ** 3;
      setDisplayXp(Math.round(xpBefore + totalXp * eased));
      if (tVal < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [xpBefore, xpAfter, totalXp, reducedMotion]);

  const { progress: xpProgress } = xpForNextLevel(displayXp);
  const mood = avgPct >= 85 ? 'excited' : avgPct >= 55 ? 'happy' : 'neutral';

  return (
    <div className="screen lesson-complete-screen">
      <header className="lesson-complete-hero">
        <PixCompanion mood={mood} size={120} animate celebrate />
        <h1 className="lesson-complete-title">{t('lessonCompleteTitle', locale)}</h1>
      </header>

      <div className="lesson-complete-stats">
        <div className="lesson-stat-card lesson-stat-card--xp">
          <span className="lesson-stat-label">{t('lessonStatXp', locale)}</span>
          <span className="lesson-stat-value">+{totalXp}</span>
        </div>
        <div className="lesson-stat-card lesson-stat-card--score">
          <span className="lesson-stat-label">{t('lessonStatScore', locale)}</span>
          <span className="lesson-stat-value">{avgPct}%</span>
        </div>
        <div className="lesson-stat-card lesson-stat-card--time">
          <span className="lesson-stat-label">{t('lessonStatTime', locale)}</span>
          <span className="lesson-stat-value">{formatTime(totalTime)}</span>
        </div>
      </div>

      <div className="lesson-xp-bar-wrap">
        <div className="lesson-xp-bar" style={{ width: `${Math.round(xpProgress * 100)}%` }} />
        <span className="lesson-xp-bar-label">{displayXp} XP</span>
      </div>

      <footer className="lesson-complete-footer">
        <button type="button" className="btn-secondary btn-lg lesson-view-path-btn" onClick={onViewPath}>
          {t('lessonViewPath', locale)}
        </button>
        <div className="lesson-complete-footer-row">
          <button type="button" className="btn-ghost lesson-home-btn" onClick={onHome}>
            {t('home', locale)}
          </button>
          <button type="button" className="btn-primary btn-lg lesson-continue-btn" onClick={onContinue}>
            {pathComplete ? t('lessonBackToPath', locale) : t('lessonNextStep', locale)}
          </button>
        </div>
      </footer>
    </div>
  );
}
