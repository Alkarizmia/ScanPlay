import type { CSSProperties } from 'react';
import {
  ACHIEVEMENTS,
  getAchievementProgress,
  getAchievementSkin,
  getUnlockedCount,
  isAchievementUnlocked,
} from '../lib/achievements';
import { AchievementGlyph } from './icons/AchievementGlyph';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface AchievementsScreenProps {
  locale: Locale;
  refreshKey: number;
}

export function AchievementsScreen({ locale, refreshKey }: AchievementsScreenProps) {
  void refreshKey;
  const unlocked = getUnlockedCount();
  const pct = Math.round((unlocked / ACHIEVEMENTS.length) * 100);

  return (
    <div className="screen tab-screen achievements-screen achievements-screen--premium">
      <header className="top-bar">
        <h2 className="screen-title">{t('achievementsTitle', locale)}</h2>
        <span className="achievements-count">{unlocked}/{ACHIEVEMENTS.length}</span>
      </header>

      <div className="achievements-hero premium-card">
        <div className="achievements-hero-ring" style={{ '--pct': pct } as CSSProperties}>
          <span className="achievements-hero-pct">{pct}%</span>
        </div>
        <p className="achievements-hero-label">{t('achievementsIntro', locale)}</p>
      </div>

      <main className="achievements-main scroll-natural">
        <div className="achievements-grid">
          {ACHIEVEMENTS.map((ach) => {
            const ok = isAchievementUnlocked(ach.id);
            const progress = getAchievementProgress(ach.id);
            const skin = getAchievementSkin(ach.id);
            const pct = progress ? Math.min(100, Math.round((progress.current / progress.target) * 100)) : 0;
            return (
              <div key={ach.id} className={`achievement-badge achievement-badge--${skin} ${ok ? 'unlocked' : 'locked'}`}>
                <span className="achievement-icon-wrap" aria-hidden="true">
                  <span className="achievement-icon">
                    <AchievementGlyph achievement={ach} size={52} locked={!ok} />
                  </span>
                </span>
                <span className="achievement-name">{t(ach.nameKey, locale)}</span>
                <span className="achievement-desc">{t(ach.descKey, locale)}</span>
                {ok ? (
                  <span className="achievement-unlocked-tag">{t('achUnlocked', locale)}</span>
                ) : progress ? (
                  <span className="achievement-track">
                    <span className="achievement-track-bar" aria-hidden="true">
                      <span className="achievement-track-fill" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="achievement-progress">
                      {progress.current}/{progress.target}
                    </span>
                  </span>
                ) : (
                  <span className="achievement-locked-tag">{t('achLocked', locale)}</span>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
