import { useEffect, useRef, useState } from 'react';
import {
  DISPLAY_NAME_MIN,
  getDisplayNameCooldownMsLeft,
  setAvatar,
  trySetDisplayName,
  type UserProfileData,
} from '../lib/profile';
import { isDisplayNameAvailable, isSocialAvailable } from '../lib/social/publicProfile';
import { createProfileAvatar } from '../lib/thumbnail';
import { t } from '../lib/i18n';
import { playSound } from '../lib/sounds';
import type { Locale } from '../types';

interface ProfileEditSheetProps {
  open: boolean;
  locale: Locale;
  profile: UserProfileData;
  onClose: () => void;
  onRefresh: () => void;
}

export function ProfileEditSheet({ open, locale, profile, onClose, onRefresh }: ProfileEditSheetProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'menu' | 'name'>('menu');
  const [nameDraft, setNameDraft] = useState(profile.displayName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameTaken, setNameTaken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const hasCustom = profile.avatar === 'custom' && Boolean(profile.customAvatarData);

  useEffect(() => {
    if (!open) return;
    setMode('menu');
    setNameDraft(profile.displayName);
    setNameError(null);
    setNameTaken(false);
    setPhotoError(null);
  }, [open, profile.displayName]);

  useEffect(() => {
    if (!open || mode !== 'name' || !isSocialAvailable()) {
      setNameTaken(false);
      return;
    }
    const trimmed = nameDraft.trim();
    if (trimmed.length < DISPLAY_NAME_MIN || trimmed === profile.displayName) {
      setNameTaken(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void isDisplayNameAvailable(trimmed).then((available) => {
        setNameTaken(available === false);
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [open, mode, nameDraft, profile.displayName]);

  if (!open) return null;

  const formatCooldownDays = (ms: number) => {
    const days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    return t('profileNameCooldown', locale).replace('{days}', String(days));
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    setPhotoError(null);
    void createProfileAvatar(file)
      .then((data) => {
        setAvatar('custom', data);
        playSound('profileUpdated');
        onRefresh();
        onClose();
      })
      .catch((err: Error) => {
        if (err.message === 'too_large') setPhotoError(t('profilePhotoTooLarge', locale));
        else if (err.message === 'not_image') setPhotoError(t('profilePhotoInvalid', locale));
        else setPhotoError(t('profilePhotoError', locale));
      });
  };

  const removePhoto = () => {
    setAvatar('avatar1');
    playSound('profileUpdated');
    onRefresh();
    onClose();
  };

  const saveName = () => {
    setNameError(null);
    if (nameTaken) {
      setNameError(t('profileNameTaken', locale));
      return;
    }
    setSaving(true);
    void trySetDisplayName(nameDraft).then((result) => {
      setSaving(false);
      if (!result.ok) {
        if (result.error === 'display_name_taken') setNameError(t('profileNameTaken', locale));
        else if (result.error === 'too_short') setNameError(t('profileNameTooShort', locale));
        else if (result.error === 'cooldown') setNameError(formatCooldownDays(result.cooldownMsLeft ?? 0));
        else setNameError(t('profileNameSaveError', locale));
        return;
      }
      playSound('profileUpdated');
      onRefresh();
      onClose();
    });
  };

  const cooldownLeft = getDisplayNameCooldownMsLeft(profile);

  return (
    <div className="profile-edit-backdrop" role="presentation" onClick={onClose}>
      <div
        className="profile-edit-sheet"
        role="dialog"
        aria-label={t('profileEditTitle', locale)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="profile-edit-handle" aria-hidden="true" />
        <p className="profile-edit-title">{t('profileEditTitle', locale)}</p>

        {mode === 'menu' ? (
          <div className="profile-edit-actions">
            <button type="button" className="profile-edit-action" onClick={() => fileRef.current?.click()}>
              {t('profileChangePhoto', locale)}
            </button>
            {hasCustom && (
              <button type="button" className="profile-edit-action profile-edit-action--danger" onClick={removePhoto}>
                {t('profileRemovePhoto', locale)}
              </button>
            )}
            <button type="button" className="profile-edit-action" onClick={() => setMode('name')}>
              {t('profileChangeName', locale)}
            </button>
            <button type="button" className="profile-edit-action profile-edit-action--cancel" onClick={onClose}>
              {t('cancel', locale)}
            </button>
            {photoError && <p className="profile-upload-error">{photoError}</p>}
          </div>
        ) : (
          <div className="profile-edit-name">
            <label className="profile-name-label" htmlFor="profile-edit-display-name">
              {t('profileDisplayName', locale)}
            </label>
            <div className="profile-name-row">
              <input
                id="profile-edit-display-name"
                className="profile-name-input"
                value={nameDraft}
                maxLength={24}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder={profile.displayName}
                autoFocus
              />
              <button type="button" className="btn-secondary btn-sm" onClick={saveName} disabled={saving || nameTaken}>
                {saving ? '…' : 'OK'}
              </button>
            </div>
            <p className="profile-name-hint">{t('profileDisplayNameHint', locale)}</p>
            {cooldownLeft > 0 && !nameError && (
              <p className="profile-name-hint">{formatCooldownDays(cooldownLeft)}</p>
            )}
            {nameTaken && !nameError && <p className="profile-upload-error">{t('profileNameTaken', locale)}</p>}
            {nameError && <p className="profile-upload-error">{nameError}</p>}
            <button type="button" className="profile-edit-action profile-edit-action--cancel" onClick={() => setMode('menu')}>
              {t('back', locale)}
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="profile-file-input"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}
