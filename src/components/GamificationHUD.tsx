import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { getGamification, getLevel, xpForNextLevel } from '../lib/gamification';
import { getCoins, isXpBoostActive } from '../lib/wallet';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface HudStatProps {
  locale: Locale;
  refreshKey?: number;
  streakPulseKey?: number;
  className?: string;
}

function useStreakBump(streakPulseKey: number) {
  const { streak } = getGamification();
  const prevStreak = useRef(streak);
  const [bumpActive, setBumpActive] = useState(false);

  useEffect(() => {
    if (streak > prevStreak.current) {
      setBumpActive(true);
      const id = window.setTimeout(() => setBumpActive(false), 600);
      prevStreak.current = streak;
      return () => window.clearTimeout(id);
    }
    prevStreak.current = streak;
  }, [streak]);

  useEffect(() => {
    if (streakPulseKey <= 0) return;
    setBumpActive(true);
    const id = window.setTimeout(() => setBumpActive(false), 600);
    return () => window.clearTimeout(id);
  }, [streakPulseKey]);

  return bumpActive;
}

export function HudStreakStat({
  locale,
  refreshKey = 0,
  streakPulseKey = 0,
  className = '',
}: HudStatProps) {
  void refreshKey;
  const { streak } = getGamification();
  const streakActive = streak > 0;
  const bumpActive = useStreakBump(streakPulseKey);

  return (
    <div
      className={`hud-duo-stat hud-duo-streak hud-streak-top ${streakActive ? 'active' : 'cold'}${bumpActive ? ' streak-bump' : ''} ${className}`.trim()}
      title={t('streak', locale)}
    >
      <span className={`hud-duo-icon hud-flame ${streakActive ? 'lit' : ''}`} aria-hidden="true">
        🔥
      </span>
      <span className="hud-duo-val">{streak}</span>
    </div>
  );
}

export function HudLevelStat({ locale, refreshKey = 0, className = '' }: HudStatProps) {
  void refreshKey;
  const { xp } = getGamification();
  const level = getLevel(xp);
  const { progress } = xpForNextLevel(xp);

  return (
    <div className={`hud-duo-stat hud-duo-level hud-level-top ${className}`.trim()} title={t('level', locale)}>
      <span className="hud-duo-level-ring" style={{ '--pct': progress } as CSSProperties}>
        <span className="hud-duo-level-num">{level}</span>
      </span>
    </div>
  );
}

export function HudCoinsStat({ locale, refreshKey = 0, className = '' }: HudStatProps) {
  void refreshKey;
  const coins = getCoins();
  const boost = isXpBoostActive();

  return (
    <div className={`hud-duo-stat hud-duo-coins ${className}`.trim()} title={t('coins', locale)}>
      <span className="hud-duo-icon" aria-hidden="true">
        🪙
      </span>
      <span className="hud-duo-val">{coins}</span>
      {boost && <span className="hud-boost-badge">x2</span>}
    </div>
  );
}

export function HudXpBar({ locale, refreshKey = 0 }: HudStatProps) {
  void refreshKey;
  const { xp } = getGamification();
  const level = getLevel(xp);
  const { progress } = xpForNextLevel(xp);

  return (
    <div className="hud-xp-bar-wrap" aria-label={t('xp', locale)}>
      <div className="hud-xp-bar-track">
        <div className="hud-xp-bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="hud-xp-bar-label">
        Lv.{level} · {Math.round(progress)}%
      </span>
    </div>
  );
}

interface GamificationHUDProps {
  locale: Locale;
  refreshKey?: number;
  streakPulseKey?: number;
  showXpBar?: boolean;
  layout?: 'row' | 'home';
}

export function GamificationHUD({
  locale,
  refreshKey = 0,
  streakPulseKey = 0,
  showXpBar = false,
  layout = 'row',
}: GamificationHUDProps) {
  if (layout === 'home') {
    return (
      <div className="gamification-hud-wrap gamification-hud-wrap--home">
        <HudCoinsStat locale={locale} refreshKey={refreshKey} className="hud-coins-centered" />
        {showXpBar && <HudXpBar locale={locale} refreshKey={refreshKey} />}
      </div>
    );
  }

  return (
    <div className="gamification-hud-wrap">
      <div className="gamification-hud gamification-hud--duo" role="group" aria-label={t('statsTitle', locale)}>
        <HudStreakStat locale={locale} refreshKey={refreshKey} streakPulseKey={streakPulseKey} />
        <HudLevelStat locale={locale} refreshKey={refreshKey} />
        <HudCoinsStat locale={locale} refreshKey={refreshKey} />
      </div>
      {showXpBar && <HudXpBar locale={locale} refreshKey={refreshKey} />}
    </div>
  );
}
