import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_AVATARS,
  completePseudoOnboarding,
  getAvatarEmoji,
  getProfile,
  pullPseudoTutoFlag,
  setAvatar,
  shouldShowPseudoOnboarding,
  trySetDisplayName,
  type AvatarId,
} from '../lib/profile';
import { getAchievementDef, getRecentUnlocks } from '../lib/achievementUnlocks';
import { countFriends } from '../lib/social/friends';
import { isDisplayNameAvailable, isSocialAvailable } from '../lib/social/publicProfile';
import { hasFeature } from '../lib/planLimits';
import { getAppStats } from '../lib/stats';
import { createProfileAvatar } from '../lib/thumbnail';
import { t } from '../lib/i18n';
import { playSound } from '../lib/sounds';
import type { Locale, TabId } from '../types';
import { NavIcon } from './icons/NavIcon';
import { SubscriptionSection } from './SubscriptionSection';
import { ProfilePseudoTuto } from './ProfilePseudoTuto';
import { ProfileCard } from './ProfileCard';
import { usePlan } from '../hooks/usePlan';

interface ProfileSectionProps {
  locale: Locale;
  refreshKey: number;
  onRefresh: () => void;
  onUpgrade: () => void;
  onToast?: (message: string) => void;
  variant?: 'embedded' | 'page';
  onOpenTab?: (tab: TabId) => void;
}

export function ProfileSection({ locale, refreshKey, onRefresh, onUpgrade, onToast, variant = 'embedded', onOpenTab }: ProfileSectionProps) {
  const profile = getProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [nameFieldEl, setNameFieldEl] = useState<HTMLDivElement | null>(null);
  const [nameDraft, setNameDraft] = useState(profile?.displayName ?? '');
  const [savedHint, setSavedHint] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameTaken, setNameTaken] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [pseudoCoach, setPseudoCoach] = useState(() => shouldShowPseudoOnboarding());
  const [tutoZoom, setTutoZoom] = useState(false);
  const closingTutoRef = useRef(false);
  const plan = usePlan(refreshKey);

  useEffect(() => {
    const p = getProfile();
    if (p) setNameDraft(p.displayName);
    setPseudoCoach(shouldShowPseudoOnboarding());
    if (shouldShowPseudoOnboarding()) {
      void pullPseudoTutoFlag().then(() => {
        setPseudoCoach(shouldShowPseudoOnboarding());
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
  const avatarEmoji = getAvatarEmoji(profile);
  const showCustom = profile.avatar === 'custom' && profile.customAvatarData;
  const featuredAchievements = getRecentUnlocks(4)
    .map((rec) => getAchievementDef(rec.id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  const publicStats = [
    { label: t('xp', locale), value: String(stats.xp) },
    { label: t('streak', locale), value: String(stats.streak) },
    { label: t('statsDecks', locale), value: String(stats.deckCount) },
  ];
  const extraStatItems = [
    { label: t('totalScore', locale), value: String(stats.totalScore) },
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

  const finishPseudoTuto = () => {
    if (!pseudoCoach || closingTutoRef.current) return;
    closingTutoRef.current = true;
    void completePseudoOnboarding();
    setTutoZoom(true);
    nameFieldEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      setPseudoCoach(false);
      setTutoZoom(false);
      closingTutoRef.current = false;
    }, 420);
  };

  const skipPseudoCoach = () => {
    playSound('tap');
    finishPseudoTuto();
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
      finishPseudoTuto();
    });
  };

  return (
    <section className={`settings-section profile-section${variant === 'page' ? ' profile-section--page' : ''}`}>
      {variant !== 'page' && <h3 className="settings-label">{t('profileSection', locale)}</h3>}

      <p className="profile-block-kicker">{t('profilePublicCard', locale)}</p>
      <ProfileCard
        locale={locale}
        displayName={profile.displayName}
        level={stats.level}
        xp={stats.xp}
        streak={stats.streak}
        friendCount={isSocialAvailable() ? friendCount : undefined}
        plan={plan}
        featuredAchievements={featuredAchievements}
        stats={publicStats}
        avatar={
          showCustom ? (
            <img src={profile.customAvatarData} alt="" className="profile-avatar-img" />
          ) : (
            <span className="profile-avatar-emoji">{avatarEmoji || '🎮'}</span>
          )
        }
      />

      <p className="profile-block-kicker">{t('profileSettingsLabel', locale)}</p>
      <div className="profile-card profile-card--settings">
        <div className={`profile-stats-block ${unlocked ? '' : 'profile-stats-block--locked'}`}>
          <p className="profile-stats-heading">{t('statsTitle', locale)}</p>
          <div className="stats-grid profile-stats-grid">
            {extraStatItems.map((item) => (
              <div key={item.label} className={`stat-tile ${unlocked ? '' : 'stat-tile--blurred'}`}>
                <span className="stat-tile-val">{item.value}</span>
                <span className="stat-tile-label">{item.label}</span>
              </div>
            ))}
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

        {pseudoCoach && (
          <ProfilePseudoTuto
            locale={locale}
            nameField={nameFieldEl}
            zooming={tutoZoom}
            onSkip={skipPseudoCoach}
          />
        )}

        <div
          ref={setNameFieldEl}
          className={`profile-name-field${pseudoCoach ? ' profile-name-field--coach' : ''}${tutoZoom ? ' profile-name-field--zoom' : ''}`}
        >
          <label className="profile-name-label" htmlFor="profile-display-name">
            {t('profileDisplayName', locale)}
          </label>
          <div className="profile-name-row">
            <input
              id="profile-display-name"
              ref={nameInputRef}
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

        {onOpenTab && (
          <nav className="profile-shortcuts" aria-label={t('profileShortcuts', locale)}>
            <p className="profile-picker-label">{t('profileShortcuts', locale)}</p>
            <ul className="profile-shortcut-list">
              {(
                [
                  { id: 'settings' as const, labelKey: 'settings' as const, featured: true },
                  { id: 'shop' as const, labelKey: 'shopTitle' as const, featured: false },
                  { id: 'mistakes' as const, labelKey: 'mistakes' as const, featured: false },
                  { id: 'achievements' as const, labelKey: 'achievements' as const, featured: false },
                ]
              ).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`profile-shortcut-row${item.featured ? ' profile-shortcut-row--featured' : ''}`}
                    onClick={() => onOpenTab(item.id)}
                  >
                    <span className="profile-shortcut-icon" aria-hidden="true">
                      <NavIcon tab={item.id} />
                    </span>
                    <span className="profile-shortcut-label">{t(item.labelKey, locale)}</span>
                    <span className="profile-shortcut-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

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
