import { useEffect, useRef, useState } from 'react';
import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  getDisplayNameCooldownMsLeft,
  type UserProfileData,
} from '../lib/profile';
import {
  PROFILE_BANNERS,
  canUseBanner,
  type ProfileBannerId,
} from '../lib/profileBanner';
import {
  PROFILE_COSMETICS,
  canUseBannerFrame,
  canUseFrame,
  ownsCosmetic,
  type AvatarRingId,
  type BannerFrameId,
} from '../lib/profileCosmetics';
import { isDisplayNameAvailable, isSocialAvailable } from '../lib/social/publicProfile';
import { createProfileAvatar } from '../lib/thumbnail';
import { t } from '../lib/i18n';
import { playSound } from '../lib/sounds';
import { usePlan } from '../hooks/usePlan';
import type { Locale } from '../types';

export type ProfileEditZone = 'photo' | 'name' | 'banner' | 'bannerFrame' | 'avatar';

export interface ProfileEditDraft {
  name: string;
  banner: ProfileBannerId;
  bannerFrame: BannerFrameId | null;
  avatarFrame: AvatarRingId | null;
  /** null = inchangé ; string = data URL custom ; 'default' = avatar mascotte */
  photo: string | null | 'default';
}

interface ProfileEditSheetProps {
  zone: ProfileEditZone | null;
  locale: Locale;
  profile: UserProfileData;
  draft: ProfileEditDraft;
  onDraftChange: (patch: Partial<ProfileEditDraft>) => void;
  onCloseZone: () => void;
  onUpgrade?: () => void;
  onOpenShop?: (cosmeticId?: string) => void;
}

const SHOP_BANNERS = PROFILE_COSMETICS.filter((c) => c.type === 'banner');
const SHOP_BANNER_FRAMES = PROFILE_COSMETICS.filter((c) => c.type === 'bannerFrame');
const SHOP_AVATAR_RINGS = PROFILE_COSMETICS.filter((c) => c.type === 'avatar');

export function ProfileEditSheet({
  zone,
  locale,
  profile,
  draft,
  onDraftChange,
  onCloseZone,
  onUpgrade,
  onOpenShop,
}: ProfileEditSheetProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const plan = usePlan();
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameTaken, setNameTaken] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (!zone) return;
    setNameError(null);
    setNameTaken(false);
    setPhotoError(null);
  }, [zone]);

  useEffect(() => {
    if (zone !== 'name' || !isSocialAvailable()) {
      setNameTaken(false);
      return;
    }
    const trimmed = draft.name.trim();
    if (
      trimmed.length < DISPLAY_NAME_MIN ||
      trimmed.length > DISPLAY_NAME_MAX ||
      trimmed === profile.displayName
    ) {
      setNameTaken(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void isDisplayNameAvailable(trimmed).then((available) => {
        setNameTaken(available === false);
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [zone, draft.name, profile.displayName]);

  if (!zone) return null;

  const cooldownLeft = getDisplayNameCooldownMsLeft(profile);
  const formatCooldownDays = (ms: number) => {
    const days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    return t('profileNameCooldown', locale).replace('{days}', String(days));
  };

  const goShop = (cosmeticId?: string) => {
    playSound('tap');
    onCloseZone();
    onOpenShop?.(cosmeticId);
  };

  const title =
    zone === 'photo'
      ? t('profileEditZonePhoto', locale)
      : zone === 'name'
        ? t('profileEditZoneName', locale)
        : zone === 'banner'
          ? t('profileEditZoneBanner', locale)
          : zone === 'bannerFrame'
            ? t('profileEditZoneBannerFrame', locale)
            : t('profileEditZoneAvatar', locale);

  const handleFile = (file: File | null) => {
    if (!file) return;
    setPhotoError(null);
    void createProfileAvatar(file)
      .then((data) => {
        onDraftChange({ photo: data });
        playSound('profileUpdated');
        onCloseZone();
      })
      .catch((err: Error) => {
        if (err.message === 'too_large') setPhotoError(t('profilePhotoTooLarge', locale));
        else if (err.message === 'not_image') setPhotoError(t('profilePhotoInvalid', locale));
        else setPhotoError(t('profilePhotoError', locale));
      });
  };

  return (
    <div className="profile-edit-backdrop" role="presentation" onClick={onCloseZone}>
      <div
        className="profile-edit-sheet"
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="profile-edit-handle" aria-hidden="true" />
        <p className="profile-edit-title">{title}</p>

        {zone === 'photo' && (
          <div className="profile-edit-actions">
            <button
              type="button"
              className="profile-edit-action"
              onClick={() => fileRef.current?.click()}
            >
              {t('profileChangePhoto', locale)}
            </button>
            {(profile.avatar === 'custom' || draft.photo) && draft.photo !== 'default' && (
              <button
                type="button"
                className="profile-edit-action profile-edit-action--danger"
                onClick={() => {
                  onDraftChange({ photo: 'default' });
                  playSound('profileUpdated');
                  onCloseZone();
                }}
              >
                {t('profileRemovePhoto', locale)}
              </button>
            )}
            {photoError && <p className="profile-upload-error">{photoError}</p>}
            <button type="button" className="profile-edit-action profile-edit-action--cancel" onClick={onCloseZone}>
              {t('back', locale)}
            </button>
          </div>
        )}

        {zone === 'name' && (
          <div className="profile-edit-name">
            <label className="profile-name-label" htmlFor="profile-edit-display-name">
              {t('profileDisplayName', locale)}
            </label>
            <div className="profile-name-row">
              <input
                id="profile-edit-display-name"
                className="profile-name-input"
                value={draft.name}
                maxLength={DISPLAY_NAME_MAX}
                onChange={(e) => {
                  setNameError(null);
                  onDraftChange({ name: e.target.value });
                }}
                placeholder={profile.displayName}
                autoFocus
              />
            </div>
            <p className="profile-name-hint">{t('profileDisplayNameHint', locale)}</p>
            {cooldownLeft > 0 && !nameError && (
              <p className="profile-name-hint">{formatCooldownDays(cooldownLeft)}</p>
            )}
            {nameTaken && !nameError && (
              <p className="profile-upload-error">{t('profileNameTaken', locale)}</p>
            )}
            {nameError && <p className="profile-upload-error">{nameError}</p>}
            <button type="button" className="profile-edit-action profile-edit-action--cancel" onClick={onCloseZone}>
              {t('back', locale)}
            </button>
          </div>
        )}

        {zone === 'banner' && (
          <div className="profile-edit-banner">
            <div className="profile-banner-grid" role="listbox" aria-label={title}>
              {PROFILE_BANNERS.map((b) => {
                const locked = !canUseBanner(b.id, plan);
                const active = draft.banner === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`profile-banner-swatch profile-banner-swatch--${b.id}${active ? ' active' : ''}${locked ? ' locked' : ''}`}
                    onClick={() => {
                      if (locked) {
                        playSound('tap');
                        onUpgrade?.();
                        return;
                      }
                      onDraftChange({ banner: b.id });
                      playSound('tap');
                    }}
                  >
                    <span className="profile-banner-swatch-preview" aria-hidden="true" />
                    <span className="profile-banner-swatch-label">{t(b.labelKey, locale)}</span>
                    {locked && <span className="profile-banner-lock">Plus</span>}
                  </button>
                );
              })}
            </div>
            <p className="profile-name-hint">{t('profileBannerShopHint', locale)}</p>
            <div className="profile-banner-grid" role="listbox">
              {SHOP_BANNERS.map((b) => {
                const locked = !ownsCosmetic(b.id);
                const active = draft.banner === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`profile-banner-swatch profile-banner-swatch--${b.id}${active ? ' active' : ''}${locked ? ' locked' : ''}`}
                    onClick={() => {
                      if (locked) {
                        goShop(b.id);
                        return;
                      }
                      onDraftChange({ banner: b.id as ProfileBannerId });
                      playSound('tap');
                    }}
                  >
                    <span className="profile-banner-swatch-preview" aria-hidden="true" />
                    <span className="profile-banner-swatch-label">{t(b.nameKey, locale)}</span>
                    {locked && (
                      <span className="profile-banner-lock profile-banner-lock--shop">
                        {t('profileCosmeticLockedShop', locale)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button type="button" className="profile-edit-action profile-edit-action--cancel" onClick={onCloseZone}>
              {t('back', locale)}
            </button>
          </div>
        )}

        {zone === 'bannerFrame' && (
          <div className="profile-edit-banner">
            <div className="profile-banner-grid" role="listbox" aria-label={title}>
              <button
                type="button"
                role="option"
                aria-selected={draft.bannerFrame == null}
                className={`profile-banner-swatch${draft.bannerFrame == null ? ' active' : ''}`}
                onClick={() => {
                  onDraftChange({ bannerFrame: null });
                  playSound('tap');
                }}
              >
                <span className="profile-banner-swatch-preview profile-frame-swatch-none" aria-hidden="true" />
                <span className="profile-banner-swatch-label">{t('profileBannerFrameNone', locale)}</span>
              </button>
              {SHOP_BANNER_FRAMES.map((f) => {
                const locked = !canUseBannerFrame(f.id);
                const active = draft.bannerFrame === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`profile-banner-swatch${active ? ' active' : ''}${locked ? ' locked' : ''}`}
                    onClick={() => {
                      if (locked) {
                        goShop(f.id);
                        return;
                      }
                      onDraftChange({ bannerFrame: f.id as BannerFrameId });
                      playSound('tap');
                    }}
                  >
                    <span
                      className={`profile-banner-swatch-preview sp-profile-hero-frame sp-profile-hero-frame--${f.id} profile-bframe-swatch-preview`}
                      aria-hidden="true"
                    />
                    <span className="profile-banner-swatch-label">{t(f.nameKey, locale)}</span>
                    {locked && (
                      <span className="profile-banner-lock profile-banner-lock--shop">
                        {t('profileCosmeticLockedShop', locale)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button type="button" className="profile-edit-action profile-edit-action--cancel" onClick={onCloseZone}>
              {t('back', locale)}
            </button>
          </div>
        )}

        {zone === 'avatar' && (
          <div className="profile-edit-banner">
            <div className="profile-banner-grid" role="listbox" aria-label={title}>
              <button
                type="button"
                role="option"
                aria-selected={draft.avatarFrame == null}
                className={`profile-banner-swatch${draft.avatarFrame == null ? ' active' : ''}`}
                onClick={() => {
                  onDraftChange({ avatarFrame: null });
                  playSound('tap');
                }}
              >
                <span className="profile-banner-swatch-preview profile-frame-swatch-none" aria-hidden="true" />
                <span className="profile-banner-swatch-label">{t('profileFrameNone', locale)}</span>
              </button>
              {SHOP_AVATAR_RINGS.map((f) => {
                const locked = !canUseFrame(f.id);
                const active = draft.avatarFrame === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`profile-banner-swatch${active ? ' active' : ''}${locked ? ' locked' : ''}`}
                    onClick={() => {
                      if (locked) {
                        goShop(f.id);
                        return;
                      }
                      onDraftChange({ avatarFrame: f.id as AvatarRingId });
                      playSound('tap');
                    }}
                  >
                    <span
                      className={`profile-banner-swatch-preview sp-profile-frame sp-profile-frame--${f.id} profile-frame-swatch-preview`}
                      aria-hidden="true"
                    />
                    <span className="profile-banner-swatch-label">{t(f.nameKey, locale)}</span>
                    {locked && (
                      <span className="profile-banner-lock profile-banner-lock--shop">
                        {t('profileCosmeticLockedShop', locale)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button type="button" className="profile-edit-action profile-edit-action--cancel" onClick={onCloseZone}>
              {t('back', locale)}
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="profile-file-input"
          onChange={(e) => {
            handleFile(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
