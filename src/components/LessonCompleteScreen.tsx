import { useEffect, useMemo, useState } from 'react';
import { getGamification, getLevel, xpForNextLevel } from '../lib/gamification';
import { getGameHudSnapshot } from '../lib/gameFeedback';
import { playSound } from '../lib/sounds';
import { hapticBurst, hapticLevelUp } from '../lib/haptics';
import { t } from '../lib/i18n';
import { ScanPlayMascot } from './mascot/ScanPlayMascot';
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

type FinalePhase = 'charge' | 'burst' | 'flash' | 'reveal';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function burstShards() {
  return Array.from({ length: 42 }, (_, i) => ({
    id: i,
    x: 8 + Math.random() * 84,
    y: 38 + Math.random() * 28,
    delay: Math.random() * 0.12,
    duration: 0.7 + Math.random() * 0.45,
    drift: (Math.random() - 0.5) * 160,
    dy: (Math.random() - 0.35) * 220,
    size: 6 + Math.random() * 10,
    color: ['#22c55e', '#4ade80', '#fbbf24', '#fb923c', '#ffffff', '#86efac'][i % 6],
    rotate: Math.random() * 360,
  }));
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
  const { streak } = getGamification();
  const { bestCombo } = getGameHudSnapshot();

  const xpAfter = getGamification().xp;
  const levelBefore = getLevel(xpBefore);
  const levelAfter = getLevel(xpAfter);
  const leveledUp = levelAfter > levelBefore;

  const [displayXp, setDisplayXp] = useState(xpBefore);
  const [phase, setPhase] = useState<FinalePhase>('charge');
  const [barPct, setBarPct] = useState(0);
  const shards = useMemo(() => burstShards(), []);
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reducedMotion) {
      setDisplayXp(xpAfter);
      setBarPct(100);
      setPhase('reveal');
      if (leveledUp) {
        playSound('levelUp');
        hapticLevelUp();
      } else {
        playSound('goalComplete');
        hapticBurst();
      }
      return;
    }

    playSound('xpGain');
    const start = performance.now();
    const fillMs = 1150;
    let frame = 0;
    const tick = (now: number) => {
      const tVal = Math.min(1, (now - start) / fillMs);
      const eased = 1 - (1 - tVal) ** 3;
      setBarPct(Math.round(eased * 100));
      setDisplayXp(Math.round(xpBefore + totalXp * eased));
      if (tVal < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);

    const burstTimer = window.setTimeout(() => {
      setPhase('burst');
      setBarPct(100);
      playSound('perfect');
      playSound('powerUp');
      hapticBurst();
    }, fillMs);

    const flashTimer = window.setTimeout(() => {
      setPhase('flash');
      hapticLevelUp();
    }, fillMs + 380);

    const revealTimer = window.setTimeout(() => {
      setPhase('reveal');
      playSound('goalComplete');
      if (leveledUp) {
        playSound('levelUp');
        hapticLevelUp();
      } else {
        hapticBurst();
      }
      setDisplayXp(xpAfter);
    }, fillMs + 900);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(burstTimer);
      window.clearTimeout(flashTimer);
      window.clearTimeout(revealTimer);
    };
  }, [leveledUp, totalXp, xpAfter, xpBefore, reducedMotion]);

  const { progress: xpProgress } = xpForNextLevel(displayXp);
  const expression = leveledUp ? 'levelup' : avgPct >= 85 ? 'celebrating' : avgPct >= 55 ? 'proud' : 'encouraging';
  const settledBar = Math.round(xpProgress * 100);
  const shownBar = phase === 'reveal' ? settledBar : barPct;
  const showTitle = phase === 'flash' || phase === 'reveal';
  const showRest = phase === 'reveal';

  return (
    <div
      className={`screen lesson-complete-screen lesson-complete-screen--${phase}${
        phase !== 'reveal' ? ' lesson-complete-screen--finale' : ''
      }`}
    >
      <div className="lesson-complete-wash" aria-hidden="true" />
      <div className="lesson-complete-burst" aria-hidden="true">
        {shards.map((p) => (
          <span
            key={p.id}
            className="lesson-complete-shard"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ['--drift' as string]: `${p.drift}px`,
              ['--dy' as string]: `${p.dy}px`,
              ['--spin' as string]: `${p.rotate}deg`,
            }}
          />
        ))}
      </div>
      <div className="lesson-complete-flash" aria-hidden="true" />

      <header className="lesson-complete-hero">
        <ScanPlayMascot expression={expression} size={120} idle celebrate={showRest} />
        <h1
          className={`lesson-complete-title${showTitle ? ' lesson-complete-title--in' : ''}`}
          aria-hidden={!showTitle}
        >
          {t('lessonCompleteTitle', locale)}
        </h1>
      </header>

      <div className={`lesson-complete-stats${showRest ? ' is-in' : ''}`}>
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

      {(streak > 0 || bestCombo >= 3) && (
        <div className={`lesson-complete-chips${showRest ? ' is-in' : ''}`}>
          {streak > 0 && (
            <span className="game-hud-chip game-hud-chip--streak">
              <span aria-hidden="true">🔥</span> {streak} · {t('streak', locale)}
            </span>
          )}
          {bestCombo >= 3 && (
            <span className="game-hud-chip game-hud-chip--combo">×{bestCombo}</span>
          )}
        </div>
      )}

      <div
        className={`lesson-xp-bar-wrap${phase === 'charge' && barPct > 82 ? ' lesson-xp-bar-wrap--hot' : ''}${
          phase === 'burst' ? ' lesson-xp-bar-wrap--boom' : ''
        }`}
      >
        <div className="lesson-xp-bar" style={{ width: `${shownBar}%` }} />
        <span className="lesson-xp-bar-label">{displayXp} XP</span>
      </div>

      <footer className={`lesson-complete-footer${showRest ? ' is-in' : ''}`}>
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
