import { useEffect, useState } from 'react';
import {
  getProfile,
  pullPseudoTutoFlag,
  shouldShowPseudoOnboarding,
} from '../lib/profile';
import { ACHIEVEMENTS, getUnlockedCount, isAchievementUnlocked } from '../lib/achievements';
import { getAchievementDef, getRecentUnlocks } from '../lib/achievementUnlocks';
import { xpForNextLevel } from '../lib/gamification';
import { countFriends } from '../lib/social/friends';
import { isSocialAvailable } from '../lib/social/publicProfile';
import { getAppStats } from '../lib/stats';
import { getMascotAssetUrl } from '../lib/mascot/catalog';
import { t } from '../lib/i18n';
import { playSound } from '../lib/sounds';
import type { Locale } from '../types';
import { AchievementGlyph } from './icons/AchievementGlyph';
import { StreakFlame } from './icons/StreakFlame';
import { PlanBadge } from './PlanBadge';
import { ProfileEditSheet } from './ProfileEditSheet';
import { usePlan } from '../hooks/usePlan';

type StatPanel = 'level' | 'streak' | null;

interface ProfileSectionProps {
  locale: Locale;
  refreshKey: number;
  onRefresh: () => void;
  onUpgrade: () => void;
  onOpenFriends?: () => void;
  onOpenAchievements?: () => void;
}

const DEFAULT_AVATAR_SRC = getMascotAssetUrl('happy') ?? '/mascot/emotions/happy.webp';

export function ProfileSection({
  locale,
  refreshKey,
  onRefresh,
  onUpgrade,
  onOpenFriends,
  onOpenAchievements,
}: ProfileSectionProps) {
  const profile = getProfile();
  const [friendCount, setFriendCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [statPanel, setStatPanel] = useState<StatPanel>(null);
  const plan = usePlan(refreshKey);

  useEffect(() => {
    if (shouldShowPseudoOnboarding()) {
      void pullPseudoTutoFlag().then(() => {
        if (shouldShowPseudoOnboarding()) setEditOpen(true);
      });
    }
  }, [refreshKey]);

  useEffect(() => {
    if (!isSocialAvailable()) {
      setFriendCount(0);
      return;
    }
    void countFriends().then(setFriendCount);
  }, [refreshKey]);

  if (!profile) return null;

  const stats = getAppStats();
  const xpNext = xpForNextLevel(stats.xp);
  const xpLeft = Math.max(0, xpNext.needed - xpNext.current);
  const showCustom = profile.avatar === 'custom' && Boolean(profile.customAvatarData);
  const recent = getRecentUnlocks(8)
    .map((rec) => getAchievementDef(rec.id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  const showcase =
    recent.length > 0
      ? recent
      : ACHIEVEMENTS.filter((a) => isAchievementUnlocked(a.id)).slice(0, 8);
  const unlockedCount = getUnlockedCount();
  const sinceYear = new Date().getFullYear();
  const recentIds = new Set(getRecentUnlocks(4).map((r) => r.id));

  const openEdit = () => {
    playSound('tap');
    setEditOpen(true);
  };

  const togglePanel = (panel: Exclude<StatPanel, null>) => {
    playSound('tap');
    setStatPanel((cur) => (cur === panel ? null : panel));
  };

  return (
    <section className="sp-profile">
      <header className="sp-profile-top">
        <h2 className="sp-profile-name">{profile.displayName}</h2>
        <button
          type="button"
          className="sp-profile-edit-btn"
          onClick={openEdit}
          aria-label={t('profileEditTitle', locale)}
        >
          <svg viewBox="0 0 24 24" className="sp-profile-edit-icon" aria-hidden="true">
            <path
              d="M12 20h9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      <div className="sp-profile-hero" aria-hidden="true">
        <div className="sp-profile-hero-glow" />
        <button type="button" className="sp-profile-avatar-btn" onClick={openEdit}>
          <img
            src={showCustom ? profile.customAvatarData! : DEFAULT_AVATAR_SRC}
            alt=""
            className={`sp-profile-avatar-img${showCustom ? '' : ' sp-profile-avatar-img--mascot'}`}
          />
        </button>
      </div>

      <div className="sp-profile-meta">
        <p className="sp-profile-handle">
          @{profile.displayName.replace(/\s+/g, '').slice(0, 18)} · {t('profileSince', locale).replace('{year}', String(sinceYear))}
        </p>
        <div className="sp-profile-plan">
          <PlanBadge plan={plan} locale={locale} />
          {plan === 'free' && (
            <button type="button" className="sp-profile-upgrade-link" onClick={onUpgrade}>
              {t('upgradePlus', locale)}
            </button>
          )}
        </div>
      </div>

      <div className="sp-profile-stats-row" role="group" aria-label={t('statsTitle', locale)}>
        <button
          type="button"
          className={`sp-profile-stat${statPanel === 'level' ? ' sp-profile-stat--active' : ''}`}
          onClick={() => togglePanel('level')}
          aria-expanded={statPanel === 'level'}
        >
          <span className="sp-profile-stat-val">{stats.level}</span>
          <span className="sp-profile-stat-label">{t('level', locale)}</span>
        </button>
        <button
          type="button"
          className="sp-profile-stat"
          onClick={() => {
            playSound('tap');
            onOpenFriends?.();
          }}
          disabled={!onOpenFriends}
        >
          <span className="sp-profile-stat-val">{isSocialAvailable() ? friendCount : '—'}</span>
          <span className="sp-profile-stat-label">{t('profileStatFriends', locale)}</span>
        </button>
        <button
          type="button"
          className={`sp-profile-stat${statPanel === 'streak' ? ' sp-profile-stat--active' : ''}`}
          onClick={() => togglePanel('streak')}
          aria-expanded={statPanel === 'streak'}
        >
          <span className="sp-profile-stat-val sp-profile-stat-val--streak">
            <StreakFlame lit={stats.streak > 0} size={16} /> {stats.streak}
          </span>
          <span className="sp-profile-stat-label">{t('streak', locale)}</span>
        </button>
      </div>

      {statPanel === 'level' && (
        <div className="sp-profile-stat-panel" role="region" aria-label={t('profileLevelProgress', locale)}>
          <div className="sp-profile-xp-track" aria-hidden="true">
            <div className="sp-profile-xp-fill" style={{ width: `${xpNext.progress}%` }} />
          </div>
          <p className="sp-profile-stat-panel-text">
            {t('profileLevelProgress', locale)
              .replace('{current}', String(Math.round(xpNext.current)))
              .replace('{needed}', String(xpNext.needed))
              .replace('{left}', String(Math.round(xpLeft)))
              .replace('{next}', String(stats.level + 1))}
          </p>
        </div>
      )}

      {statPanel === 'streak' && (
        <div className="sp-profile-stat-panel" role="region" aria-label={t('streak', locale)}>
          <p className="sp-profile-stat-panel-text">
            {stats.streak > 0
              ? t('profileStreakTip', locale).replace('{n}', String(stats.streak))
              : t('profileStreakEmpty', locale)}
          </p>
        </div>
      )}

      {onOpenFriends && (
        <div className="sp-profile-actions">
          <button
            type="button"
            className="sp-profile-add-friends"
            onClick={() => {
              playSound('tap');
              onOpenFriends();
            }}
          >
            + {t('profileAddFriends', locale)}
          </button>
        </div>
      )}

      <section className="sp-profile-block">
        <h3 className="sp-profile-block-title">{t('profileRecap', locale)}</h3>
        <div className="sp-profile-recap">
          <div className="sp-profile-recap-tile">
            <span className="sp-profile-recap-val">{stats.xp}</span>
            <span className="sp-profile-recap-label">{t('xp', locale)}</span>
          </div>
          <div className="sp-profile-recap-tile">
            <span className="sp-profile-recap-val">{stats.totalScans}</span>
            <span className="sp-profile-recap-label">{t('statsScans', locale)}</span>
          </div>
          <div className="sp-profile-recap-tile">
            <span className="sp-profile-recap-val">{stats.deckCount}</span>
            <span className="sp-profile-recap-label">{t('statsDecks', locale)}</span>
          </div>
          <div className="sp-profile-recap-tile">
            <span className="sp-profile-recap-val">{unlockedCount}</span>
            <span className="sp-profile-recap-label">{t('achievements', locale)}</span>
          </div>
        </div>
      </section>

      <section className="sp-profile-block">
        <div className="sp-profile-block-head">
          <h3 className="sp-profile-block-title">{t('achievements', locale)}</h3>
          {onOpenAchievements && (
            <button
              type="button"
              className="sp-profile-see-all"
              onClick={() => {
                playSound('tap');
                onOpenAchievements();
              }}
            >
              {t('profileSeeAllAchievements', locale)} ›
            </button>
          )}
        </div>
        <div className="sp-profile-ach-row">
          {showcase.length === 0 ? (
            <p className="sp-profile-ach-empty">{t('profileAchievementsEmpty', locale)}</p>
          ) : (
            showcase.map((ach) => {
              const unlocked = isAchievementUnlocked(ach.id);
              const isNew = recentIds.has(ach.id);
              return (
                <button
                  key={ach.id}
                  type="button"
                  className={`sp-ach-emblem${unlocked ? ' sp-ach-emblem--live' : ' sp-ach-emblem--locked'}${isNew ? ' sp-ach-emblem--new' : ''}`}
                  onClick={onOpenAchievements}
                  title={t(ach.nameKey, locale)}
                >
                  {isNew && <span className="sp-ach-new">{t('profileAchNew', locale)}</span>}
                  <span className="sp-ach-shield">
                    <AchievementGlyph achievement={ach} size={56} locked={!unlocked} />
                  </span>
                  <span className="sp-ach-caption">{t(ach.nameKey, locale)}</span>
                </button>
              );
            })
          )}
        </div>
      </section>

      <ProfileEditSheet
        open={editOpen}
        locale={locale}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onRefresh={onRefresh}
      />
    </section>
  );
}
