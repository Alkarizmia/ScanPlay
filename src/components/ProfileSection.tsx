import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  DEFAULT_AVATARS,
  getAvatarEmoji,
  getProfile,
  setAvatar,
  trySetDisplayName,
  type AvatarId,
} from '../lib/profile';
import { xpForNextLevel } from '../lib/gamification';
import { countFriends } from '../lib/social/friends';
import { isDisplayNameAvailable, isSocialAvailable } from '../lib/social/publicProfile';
import { hasFeature } from '../lib/planLimits';
import { getAppStats } from '../lib/stats';
import { createProfileAvatar } from '../lib/thumbnail';
import { t } from '../lib/i18n';
import { playSound } from '../lib/sounds';
import type { Locale } from '../types';
import { SubscriptionSection } from './SubscriptionSection';

interface ProfileSectionProps {
  locale: Locale;
  refreshKey: number;
  onRefresh: () => void;
  onUpgrade: () => void;
  onToast?: (message: string) => void;
  variant?: 'embedded' | 'page';
}

export function ProfileSection({ locale, refreshKey, onRefresh, onUpgrade, onToast, variant = 'embedded' }: ProfileSectionProps) {
  const profile = getProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nameDraft, setNameDraft] = useState(profile?.displayName ?? '');
  const [savedHint, setSavedHint] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameTaken, setNameTaken] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [friendCount, setFriendCount] = useState(0);

  useEffect(() => {
    const p = getProfile();
    if (p) setNameDraft(p.displayName);
  }, [refreshKey]);

  useEffect(() => {
    if (!isSocialAvailable()) {
      setFriendCount(0);
      return;
    }
    void countFriends().then(setFriendCount);
  }, [refreshKey]);

  useEffect(() => {
    if (!isSocialAvailable() || !profile) {
      setNameTaken(false);
      return;
    }
    const trimmed = nameDraft.trim();
    if (trimmed.length < 2 || trimmed === profile.displayName) {
      setNameTaken(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void isDisplayNameAvailable(trimmed).then((available) => {
        setNameTaken(available === false);
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [nameDraft, profile?.displayName]);

  if (!profile) return null;

  const stats = getAppStats();
  const unlocked = hasFeature('stats');
  const { progress } = xpForNextLevel(stats.xp);
  const avatarEmoji = getAvatarEmoji(profile);
  const showCustom = profile.avatar === 'custom' && profile.customAvatarData;

  const statItems = [
    { label: t('xp', locale), value: String(stats.xp) },
    { label: t('streak', locale), value: String(stats.streak) },
    { label: t('totalScore', locale), value: String(stats.totalScore) },
    { label: t('statsDecks', locale), value: String(stats.deckCount) },
    { label: t('statsScans', locale), value: String(stats.totalScans) },
    { label: t('statsSteps', locale), value: String(stats.stepsCompleted) },
  ];

  const pickAvatar = (id: AvatarId) => {
    setAvatar(id);
    playSound('profileUpdated');
    onRefresh();
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    setUploadError(null);
    void createProfileAvatar(file)
      .then((data) => {
        setAvatar('custom', data);
        playSound('profileUpdated');
        onRefresh();
      })
      .catch((err: Error) => {
        if (err.message === 'too_large') {
          setUploadError(t('profilePhotoTooLarge', locale));
        } else if (err.message === 'not_image') {
          setUploadError(t('profilePhotoInvalid', locale));
        } else {
          setUploadError(t('profilePhotoError', locale));
        }
      });
  };

  const saveName = () => {
    setNameError(null);
    if (nameTaken) {
      setNameError(t('profileNameTaken', locale));
      return;
    }
    setSavingName(true);
    void trySetDisplayName(nameDraft).then((result) => {
      setSavingName(false);
      if (!result.ok) {
        if (result.error === 'display_name_taken') {
          setNameError(t('profileNameTaken', locale));
        } else if (result.error === 'too_short') {
          setNameError(t('profileNameTooShort', locale));
        } else {
          setNameError(t('profileNameSaveError', locale));
        }
        return;
      }
      onRefresh();
      setSavedHint(true);
      playSound('profileUpdated');
      window.setTimeout(() => setSavedHint(false), 2000);
    });
  };

  return (
    <section className={`settings-section profile-section${variant === 'page' ? ' profile-section--page' : ''}`}>
      {variant !== 'page' && <h3 className="settings-label">{t('profileSection', locale)}</h3>}

      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-header-left">
            <div className="profile-avatar-preview" aria-hidden="true">
              {showCustom ? (
                <img src={profile.customAvatarData} alt="" className="profile-avatar-img" />
              ) : (
                <span className="profile-avatar-emoji">{avatarEmoji || '🎮'}</span>
              )}
            </div>
            <div className="profile-header-info">
              <p className="profile-header-name">{profile.displayName}</p>
              <p className="profile-header-meta">
                {stats.xp} {t('xp', locale)}
                {stats.streak > 0 && (
                  <>
                    {' · '}
                    <span className="profile-header-streak">🔥 {stats.streak}</span>
                  </>
                )}
              </p>
              {isSocialAvailable() && (
                <p className="profile-friend-count">
                  👥 {friendCount} {t('friendsCountLabel', locale)}
                </p>
              )}
            </div>
          </div>

          <div className="profile-level-badge" title={t('level', locale)}>
            <div
              className="hud-level-ring profile-level-ring"
              style={{ '--pct': progress } as CSSProperties}
            >
              <span className="hud-level-num">{stats.level}</span>
            </div>
            <span className="profile-level-label">{t('level', locale)}</span>
          </div>
        </div>

        <div className="hud-xp-bar-wrap profile-xp-bar" aria-label={t('xp', locale)}>
          <div className="hud-xp-bar-track">
            <div className="hud-xp-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="hud-xp-bar-label">
            Lv.{stats.level} · {Math.round(progress)}%
          </span>
        </div>

        <div className={`profile-stats-block ${unlocked ? '' : 'profile-stats-block--locked'}`}>
          <p className="profile-stats-heading">{t('statsTitle', locale)}</p>
          <div className="stats-grid profile-stats-grid">
            {statItems.map((item, i) => {
              const blurred = !unlocked && i >= 2;
              return (
                <div key={item.label} className={`stat-tile ${blurred ? 'stat-tile--blurred' : ''}`}>
                  <span className="stat-tile-val">{item.value}</span>
                  <span className="stat-tile-label">{item.label}</span>
                </div>
              );
            })}
          </div>
          {!unlocked && (
            <>
              <p className="stats-lock-hint">{t('statsLockedHint', locale)}</p>
              <button type="button" className="btn-secondary profile-stats-upgrade" onClick={onUpgrade}>
                {t('upgradePlus', locale)}
              </button>
            </>
          )}
        </div>

        <div className="profile-card-divider" role="presentation" />

        <div className="profile-avatar-picker">
          <p className="profile-picker-label">{t('profileAvatar', locale)}</p>
          <div className="profile-avatar-grid">
            {DEFAULT_AVATARS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`profile-avatar-btn ${profile.avatar === a.id ? 'active' : ''}`}
                onClick={() => pickAvatar(a.id)}
                aria-label={a.emoji}
              >
                {a.emoji}
              </button>
            ))}
            <button
              type="button"
              className={`profile-avatar-btn profile-avatar-btn--upload ${profile.avatar === 'custom' ? 'active' : ''}`}
              onClick={() => fileRef.current?.click()}
            >
              📁
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="profile-file-input"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <p className="profile-upload-hint">{t('profileChoosePhoto', locale)}</p>
          {uploadError && <p className="profile-upload-error">{uploadError}</p>}
        </div>

        <div className="profile-name-field">
          <label className="profile-name-label" htmlFor="profile-display-name">
            {t('profileDisplayName', locale)}
          </label>
          <div className="profile-name-row">
            <input
              id="profile-display-name"
              className="profile-name-input"
              value={nameDraft}
              maxLength={24}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder={profile.displayName}
            />
            <button type="button" className="btn-secondary btn-sm" onClick={saveName} disabled={savingName || nameTaken}>
              {savingName ? '…' : 'OK'}
            </button>
          </div>
          <p className="profile-name-hint">{t('profileDisplayNameHint', locale)}</p>
          {nameTaken && !nameError && <p className="profile-upload-error">{t('profileNameTaken', locale)}</p>}
          {nameError && <p className="profile-upload-error">{nameError}</p>}
          {savedHint && <p className="profile-saved-hint">{t('profileNameSaved', locale)}</p>}
        </div>

        <div className="profile-card-divider" role="presentation" />

        <SubscriptionSection
          embedded
          locale={locale}
          isLoggedIn
          onPricing={onUpgrade}
          onAuth={() => {}}
          onToast={onToast}
        />
      </div>
    </section>
  );
}
