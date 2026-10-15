import { useEffect, useMemo, useState } from 'react';
import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  getProfile,
  setAvatar,
  trySetDisplayName,
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
import { AchievementShieldFrame } from './icons/AchievementShieldFrame';
import { NavIcon } from './icons/NavIcon';
import { StreakFlame } from './icons/StreakFlame';
import { PlanBadge } from './PlanBadge';
import {
  ProfileEditSheet,
  type ProfileEditDraft,
  type ProfileEditZone,
} from './ProfileEditSheet';
import { VerifiedBadge } from './icons/VerifiedBadge';
import { usePlan } from '../hooks/usePlan';
import {
  canUseBanner,
  getProfileBanner,
  hasVerifiedBadge,
  setProfileBanner,
} from '../lib/profileBanner';
import {
  getAvatarFrame,
  getBannerFrame,
  setAvatarFrame,
  setBannerFrame,
  type AvatarRingId,
  type BannerFrameId,
} from '../lib/profileCosmetics';

type StatPanel = 'level' | 'streak' | null;

interface ProfileSectionProps {
  locale: Locale;
  refreshKey: number;
  onRefresh: () => void;
  onUpgrade: () => void;
  onOpenFriends?: () => void;
  onOpenAchievements?: () => void;
  onOpenSettings?: () => void;
  onOpenShop?: (cosmeticId?: string) => void;
}

const DEFAULT_AVATAR_SRC = getMascotAssetUrl('happy') ?? '/mascot/emotions/happy.webp';

function PencilMark() {
  return (
    <span className="sp-profile-hotspot-pencil" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="12" height="12">
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
    </span>
  );
}

function snapshotDraft(plan: ReturnType<typeof usePlan>, displayName: string): ProfileEditDraft {
  return {
    name: displayName,
    banner: getProfileBanner(plan),
    bannerFrame: getBannerFrame(),
    avatarFrame: getAvatarFrame(),
    photo: null,
  };
}

export function ProfileSection({
  locale,
  refreshKey,
  onRefresh,
  onUpgrade,
  onOpenFriends,
  onOpenAchievements,
  onOpenSettings,
  onOpenShop,
}: ProfileSectionProps) {
  const profile = getProfile();
  const [friendCount, setFriendCount] = useState(0);
  const [statPanel, setStatPanel] = useState<StatPanel>(null);
  const [editing, setEditing] = useState(false);
  const [zone, setZone] = useState<ProfileEditZone | null>(null);
  const [draft, setDraft] = useState<ProfileEditDraft | null>(null);
  const [baseline, setBaseline] = useState<ProfileEditDraft | null>(null);
  const [shake, setShake] = useState(false);
  const [discardAsk, setDiscardAsk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const plan = usePlan(refreshKey);
  const savedBanner = getProfileBanner(plan);
  const savedFrame = getAvatarFrame();
  const savedBannerFrame = getBannerFrame();
  const verified = hasVerifiedBadge(plan);

  useEffect(() => {
    if (!isSocialAvailable()) {
      setFriendCount(0);
      return;
    }
    void countFriends().then(setFriendCount);
  }, [refreshKey]);

  const dirty = useMemo(() => {
    if (!editing || !draft || !baseline) return false;
    return (
      draft.name.trim() !== baseline.name.trim() ||
      draft.banner !== baseline.banner ||
      draft.bannerFrame !== baseline.bannerFrame ||
      draft.avatarFrame !== baseline.avatarFrame ||
      draft.photo !== null
    );
  }, [editing, draft, baseline]);

  if (!profile) return null;

  const stats = getAppStats();
  const xpNext = xpForNextLevel(stats.xp);
  const xpLeft = Math.max(0, xpNext.needed - xpNext.current);
  const banner = editing && draft ? draft.banner : savedBanner;
  const frame = editing && draft ? draft.avatarFrame : savedFrame;
  const bannerFrame = editing && draft ? draft.bannerFrame : savedBannerFrame;
  const displayName = editing && draft ? draft.name : profile.displayName;

  let avatarSrc = DEFAULT_AVATAR_SRC;
  let showCustom = false;
  if (editing && draft?.photo === 'default') {
    avatarSrc = DEFAULT_AVATAR_SRC;
    showCustom = false;
  } else if (editing && draft?.photo && draft.photo !== 'default') {
    avatarSrc = draft.photo;
    showCustom = true;
  } else if (profile.avatar === 'custom' && profile.customAvatarData) {
    avatarSrc = profile.customAvatarData;
    showCustom = true;
  }

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

  const enterEdit = () => {
    playSound('tap');
    const snap = snapshotDraft(plan, profile.displayName);
    setDraft(snap);
    setBaseline(snap);
    setZone(null);
    setDiscardAsk(false);
    setSaveError(null);
    setEditing(true);
    setStatPanel(null);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (!reduce) {
      setShake(true);
      window.setTimeout(() => setShake(false), 500);
    }
  };

  const exitEdit = () => {
    setEditing(false);
    setZone(null);
    setDraft(null);
    setBaseline(null);
    setDiscardAsk(false);
    setSaveError(null);
  };

  const requestCancel = () => {
    playSound('tap');
    if (dirty) {
      setZone(null);
      setDiscardAsk(true);
      return;
    }
    exitEdit();
  };

  const confirmSave = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setSaveError(null);
    playSound('tap');

    const nameTrim = draft.name.trim();
    if (nameTrim !== profile.displayName) {
      if (nameTrim.length < DISPLAY_NAME_MIN) {
        setSaveError(t('profileNameTooShort', locale));
        setSaving(false);
        setZone('name');
        return;
      }
      if (nameTrim.length > DISPLAY_NAME_MAX) {
        setSaveError(t('profileNameTooLong', locale));
        setSaving(false);
        setZone('name');
        return;
      }
      const nameResult = await trySetDisplayName(nameTrim);
      if (!nameResult.ok) {
        if (nameResult.error === 'display_name_taken') setSaveError(t('profileNameTaken', locale));
        else if (nameResult.error === 'too_short') setSaveError(t('profileNameTooShort', locale));
        else if (nameResult.error === 'too_long') setSaveError(t('profileNameTooLong', locale));
        else if (nameResult.error === 'cooldown') {
          const days = Math.max(1, Math.ceil((nameResult.cooldownMsLeft ?? 0) / (24 * 60 * 60 * 1000)));
          setSaveError(t('profileNameCooldown', locale).replace('{days}', String(days)));
        } else setSaveError(t('profileNameSaveError', locale));
        setSaving(false);
        setZone('name');
        return;
      }
    }

    if (canUseBanner(draft.banner, plan)) {
      setProfileBanner(draft.banner);
    }

    if (draft.bannerFrame == null) {
      setBannerFrame(null);
    } else {
      setBannerFrame(draft.bannerFrame as BannerFrameId);
    }

    if (draft.avatarFrame == null) {
      setAvatarFrame(null);
    } else {
      setAvatarFrame(draft.avatarFrame as AvatarRingId);
    }

    if (draft.photo === 'default') {
      setAvatar('avatar1');
    } else if (typeof draft.photo === 'string') {
      setAvatar('custom', draft.photo);
    }

    playSound('profileUpdated');
    setSaving(false);
    exitEdit();
    onRefresh();
  };

  const openZone = (z: ProfileEditZone) => {
    if (!editing) return;
    playSound('tap');
    setZone(z);
    setDiscardAsk(false);
  };

  const togglePanel = (panel: Exclude<StatPanel, null>) => {
    if (editing) return;
    playSound('tap');
    setStatPanel((cur) => (cur === panel ? null : panel));
  };

  const patchDraft = (patch: Partial<ProfileEditDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <section className={`sp-profile${editing ? ' sp-profile--editing' : ''}${shake ? ' sp-profile--edit-shake' : ''}`}>
      <header className="sp-profile-top">
        {editing ? (
          <div className="sp-profile-edit-bar" role="toolbar" aria-label={t('profileEditTitle', locale)}>
            <button
              type="button"
              className="sp-profile-edit-bar-btn"
              onClick={requestCancel}
              aria-label={t('cancel', locale)}
            >
              ✕
            </button>
            <span className="sp-profile-edit-bar-title">{t('profileEditTitle', locale)}</span>
            <button
              type="button"
              className="sp-profile-edit-bar-btn sp-profile-edit-bar-btn--ok"
              onClick={() => void confirmSave()}
              disabled={saving}
              aria-label={t('profileEditConfirm', locale)}
            >
              ✓
            </button>
          </div>
        ) : (
          <>
            <h2 className="sp-profile-name">
              {profile.displayName}
              {verified && (
                <VerifiedBadge size={18} className="sp-profile-verified" title={t('verifiedMax', locale)} />
              )}
            </h2>
            <div className="sp-profile-top-actions">
              {onOpenSettings && (
                <button
                  type="button"
                  className="sp-profile-edit-btn"
                  onClick={() => {
                    playSound('tap');
                    onOpenSettings();
                  }}
                  aria-label={t('settings', locale)}
                  title={t('settings', locale)}
                >
                  <NavIcon tab="settings" className="sp-profile-edit-icon" />
                </button>
              )}
              <button
                type="button"
                className="sp-profile-edit-btn"
                onClick={enterEdit}
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
            </div>
          </>
        )}
      </header>

      {saveError && editing && <p className="sp-profile-edit-error">{saveError}</p>}

      <div
        className={`sp-profile-hero sp-profile-hero--${banner}${
          bannerFrame ? ` sp-profile-hero-frame sp-profile-hero-frame--${bannerFrame}` : ''
        }${editing ? ' sp-profile-hotspot' : ''}`}
      >
        <div className="sp-profile-hero-glow" />
        <img className="sp-profile-hero-logo" src="/logo-128.png?v=9" alt="" width={40} height={40} />
        {editing && (
          <button
            type="button"
            className="sp-profile-hotspot-hit sp-profile-hotspot-hit--banner"
            onClick={() => openZone('banner')}
            aria-label={t('profileEditZoneBanner', locale)}
          >
            <PencilMark />
            <span className="sp-profile-hotspot-label">{t('profileEditZoneBanner', locale)}</span>
          </button>
        )}
        {editing && (
          <button
            type="button"
            className="sp-profile-hotspot-hit sp-profile-hotspot-hit--banner-frame"
            onClick={() => openZone('bannerFrame')}
            aria-label={t('profileEditZoneBannerFrame', locale)}
          >
            <PencilMark />
            <span className="sp-profile-hotspot-label">{t('profileEditZoneBannerFrame', locale)}</span>
          </button>
        )}
        <button
          type="button"
          className={`sp-profile-avatar-btn${frame ? ` sp-profile-frame sp-profile-frame--${frame}` : ''}${
            editing ? ' sp-profile-hotspot' : ''
          }`}
          onClick={() => (editing ? openZone('photo') : enterEdit())}
          aria-label={editing ? t('profileEditZonePhoto', locale) : t('profileEditTitle', locale)}
        >
          <img
            src={avatarSrc}
            alt=""
            className={`sp-profile-avatar-img${showCustom ? '' : ' sp-profile-avatar-img--mascot'}`}
          />
          {editing && <PencilMark />}
        </button>
        {editing && (
          <button
            type="button"
            className="sp-profile-hotspot-hit sp-profile-hotspot-hit--avatar-ring"
            onClick={() => openZone('avatar')}
            aria-label={t('profileEditZoneAvatar', locale)}
          >
            <PencilMark />
            <span className="sp-profile-hotspot-label">{t('profileEditZoneAvatar', locale)}</span>
          </button>
        )}
      </div>

      <div className="sp-profile-meta">
        {editing ? (
          <button
            type="button"
            className="sp-profile-hotspot sp-profile-hotspot--name"
            onClick={() => openZone('name')}
            aria-label={t('profileEditZoneName', locale)}
          >
            <span className="sp-profile-name sp-profile-name--inline">
              {displayName.trim() || profile.displayName}
              {verified && (
                <VerifiedBadge size={18} className="sp-profile-verified" title={t('verifiedMax', locale)} />
              )}
            </span>
            <PencilMark />
          </button>
        ) : null}
        <p className="sp-profile-handle">
          <span className="sp-profile-handle-name">
            @{(displayName || profile.displayName).replace(/\s+/g, '').slice(0, 18)}
          </span>
          {' · '}
          {t('profileSince', locale).replace('{year}', String(sinceYear))}
        </p>
        <div className="sp-profile-plan">
          <PlanBadge plan={plan} locale={locale} />
          {plan === 'free' && !editing && (
            <button type="button" className="sp-profile-upgrade-link" onClick={onUpgrade}>
              {t('upgradePlus', locale)}
            </button>
          )}
        </div>
      </div>

      <div className={`sp-profile-rest${editing ? ' sp-profile-rest--dimmed' : ''}`} inert={editing || undefined}>
        <div className="sp-profile-stats-row" role="group" aria-label={t('statsTitle', locale)}>
          <button
            type="button"
            className={`sp-profile-stat${statPanel === 'level' ? ' sp-profile-stat--active' : ''}`}
            onClick={() => togglePanel('level')}
            aria-expanded={statPanel === 'level'}
            tabIndex={editing ? -1 : undefined}
          >
            <span className="sp-profile-stat-val">{stats.level}</span>
            <span className="sp-profile-stat-label">{t('level', locale)}</span>
          </button>
          <button
            type="button"
            className="sp-profile-stat"
            onClick={() => {
              if (editing) return;
              playSound('tap');
              onOpenFriends?.();
            }}
            disabled={!onOpenFriends || editing}
          >
            <span className="sp-profile-stat-val">{isSocialAvailable() ? friendCount : '-'}</span>
            <span className="sp-profile-stat-label">{t('profileStatFriends', locale)}</span>
          </button>
          <button
            type="button"
            className={`sp-profile-stat${statPanel === 'streak' ? ' sp-profile-stat--active' : ''}`}
            onClick={() => togglePanel('streak')}
            aria-expanded={statPanel === 'streak'}
            tabIndex={editing ? -1 : undefined}
          >
            <span className="sp-profile-stat-val sp-profile-stat-val--streak">
              <StreakFlame lit={stats.streak > 0} size={16} /> {stats.streak}
            </span>
            <span className="sp-profile-stat-label">{t('streak', locale)}</span>
          </button>
        </div>

        {statPanel === 'level' && !editing && (
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

        {statPanel === 'streak' && !editing && (
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
              tabIndex={editing ? -1 : undefined}
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
                tabIndex={editing ? -1 : undefined}
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
                    tabIndex={editing ? -1 : undefined}
                  >
                    {isNew && <span className="sp-ach-new">{t('profileAchNew', locale)}</span>}
                    <span className="sp-ach-shield">
                      <AchievementShieldFrame locked={!unlocked} size={72}>
                        <AchievementGlyph achievement={ach} size={40} locked={!unlocked} />
                      </AchievementShieldFrame>
                    </span>
                    <span className="sp-ach-caption">{t(ach.nameKey, locale)}</span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      {discardAsk && (
        <div className="sp-profile-discard" role="dialog" aria-label={t('profileEditDiscardTitle', locale)}>
          <p className="sp-profile-discard-text">{t('profileEditDiscardTitle', locale)}</p>
          <div className="sp-profile-discard-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                playSound('tap');
                setDiscardAsk(false);
              }}
            >
              {t('back', locale)}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                playSound('tap');
                exitEdit();
              }}
            >
              {t('profileEditDiscardConfirm', locale)}
            </button>
          </div>
        </div>
      )}

      {editing && draft && (
        <ProfileEditSheet
          zone={zone}
          locale={locale}
          profile={profile}
          draft={draft}
          onDraftChange={patchDraft}
          onCloseZone={() => setZone(null)}
          onUpgrade={onUpgrade}
          onOpenShop={onOpenShop}
        />
      )}
    </section>
  );
}
