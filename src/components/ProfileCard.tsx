import type { CSSProperties, ReactNode } from 'react';
import type { AchievementDef } from '../lib/achievements';
import { xpForNextLevel } from '../lib/gamification';
import { t } from '../lib/i18n';
import type { Locale, Plan } from '../types';
import { AchievementGlyph } from './icons/AchievementGlyph';
import { StreakFlame } from './icons/StreakFlame';
import { PlanBadge } from './PlanBadge';

export interface ProfileCardStat {
  label: string;
  value: string;
}

interface ProfileCardProps {
  locale: Locale;
  displayName: string;
  level: number;
  xp: number;
  streak: number;
  avatar: ReactNode;
  friendCount?: number;
  plan?: Plan;
  featuredAchievements?: AchievementDef[];
  stats?: ProfileCardStat[];
  children?: ReactNode;
}

/** Carte publique : avatar, pseudo, niveau, stats clés, badges mis en avant. */
export function ProfileCard({
  locale,
  displayName,
  level,
  xp,
  streak,
  avatar,
  friendCount,
  plan,
  featuredAchievements = [],
  stats = [],
  children,
}: ProfileCardProps) {
  const { progress } = xpForNextLevel(xp);

  return (
    <div className="profile-card profile-card--public">
      <div className="profile-header">
        <div className="profile-header-left">
          <div className="profile-avatar-preview" aria-hidden="true">
            {avatar}
          </div>
          <div className="profile-header-info">
            <p className="profile-header-name">{displayName}</p>
            <p className="profile-header-meta">
              {xp} {t('xp', locale)}
              {streak > 0 && (
                <>
                  {' · '}
                  <span className="profile-header-streak">
                    <StreakFlame lit size={14} /> {streak}
                  </span>
                </>
              )}
            </p>
            {friendCount != null && (
              <p className="profile-friend-count">
                {friendCount} {t('friendsCountLabel', locale)}
              </p>
            )}
            {plan && (
              <div className="profile-card-plan">
                <PlanBadge plan={plan} locale={locale} />
              </div>
            )}
          </div>
        </div>

        <div className="profile-level-badge" title={t('level', locale)}>
          <div className="hud-level-ring profile-level-ring" style={{ '--pct': progress } as CSSProperties}>
            <span className="hud-level-num">{level}</span>
          </div>
          <span className="profile-level-label">{t('level', locale)}</span>
        </div>
      </div>

      <div className="hud-xp-bar-wrap profile-xp-bar" aria-label={t('xp', locale)}>
        <div className="hud-xp-bar-track">
          <div className="hud-xp-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="hud-xp-bar-label">
          Lv.{level} · {Math.round(progress)}%
        </span>
      </div>

      {stats.length > 0 && (
        <div className="profile-stats-block">
          <div className="stats-grid profile-stats-grid profile-stats-grid--keys">
            {stats.map((item) => (
              <div key={item.label} className="stat-tile">
                <span className="stat-tile-val">{item.value}</span>
                <span className="stat-tile-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {featuredAchievements.length > 0 && (
        <div className="profile-card-featured">
          <p className="profile-picker-label">{t('profileFeaturedBadges', locale)}</p>
          <div className="profile-card-featured-row">
            {featuredAchievements.map((ach) => (
              <span key={ach.id} title={t(ach.nameKey, locale)}>
                <AchievementGlyph achievement={ach} size={40} />
              </span>
            ))}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
