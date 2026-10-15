import { useEffect, useMemo, useState } from 'react';
import { LootCoin } from './icons/EconomyIcons';
import { getMascotAssetUrl } from '../lib/mascot/catalog';
import { getProfile } from '../lib/profile';
import { getProfileBanner } from '../lib/profileBanner';
import {
  COSMETIC_SHOP_SECTIONS,
  equipCosmetic,
  getAvatarFrame,
  getBannerFrame,
  getCosmetic,
  listCosmeticsByType,
  ownsCosmetic,
  rarityLabelKey,
  unequipBannerFrame,
  unequipFrame,
  type ProfileCosmeticDef,
  type ProfileCosmeticId,
} from '../lib/profileCosmetics';
import { buyProfileCosmetic } from '../lib/shop';
import { getCoins } from '../lib/wallet';
import { usePlan } from '../hooks/usePlan';
import { t } from '../lib/i18n';
import { playSound } from '../lib/sounds';
import type { Locale } from '../types';

const DEFAULT_AVATAR = getMascotAssetUrl('happy') ?? '/mascot/emotions/happy.webp';

interface ProfileCosmeticShopProps {
  locale: Locale;
  refreshKey: number;
  onRefresh: () => void;
  onToast?: (message: string) => void;
  focusCosmeticId?: string | null;
  onFocusCosmeticConsumed?: () => void;
}

function statusFor(
  item: ProfileCosmeticDef,
  equippedBanner: string,
  equippedBannerFrame: string | null,
  equippedAvatar: string | null,
): 'buy' | 'owned' | 'equipped' {
  if (!ownsCosmetic(item.id)) return 'buy';
  if (item.type === 'banner' && equippedBanner === item.id) return 'equipped';
  if (item.type === 'bannerFrame' && equippedBannerFrame === item.id) return 'equipped';
  if (item.type === 'avatar' && equippedAvatar === item.id) return 'equipped';
  return 'owned';
}

function miniClasses(
  item: ProfileCosmeticDef,
  equippedBanner: string,
  equippedBannerFrame: string | null,
): { hero: string; avatar: string } {
  const bannerId = item.type === 'banner' ? item.id : equippedBanner;
  const heroFrame =
    item.type === 'bannerFrame'
      ? item.id
      : equippedBannerFrame;
  const hero = [
    'shop-cosmetic-mini',
    'sp-profile-hero',
    `sp-profile-hero--${bannerId}`,
    heroFrame ? `sp-profile-hero-frame sp-profile-hero-frame--${heroFrame}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const avatar =
    item.type === 'avatar' ? `shop-cosmetic-mini-avatar sp-profile-frame sp-profile-frame--${item.id}` : 'shop-cosmetic-mini-avatar';
  return { hero, avatar };
}

export function ProfileCosmeticShop({
  locale,
  refreshKey,
  onRefresh,
  onToast,
  focusCosmeticId,
  onFocusCosmeticConsumed,
}: ProfileCosmeticShopProps) {
  const plan = usePlan(refreshKey);
  const profile = getProfile();
  const coins = getCoins();
  const equippedBanner = getProfileBanner(plan);
  const equippedBannerFrame = getBannerFrame();
  const equippedAvatar = getAvatarFrame();
  const sections = useMemo(
    () =>
      COSMETIC_SHOP_SECTIONS.map((s) => ({
        ...s,
        items: listCosmeticsByType(s.type),
      })),
    [refreshKey, coins],
  );
  const [preview, setPreview] = useState<ProfileCosmeticDef | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!focusCosmeticId) return;
    const item = getCosmetic(focusCosmeticId);
    if (item) {
      setPreview(item);
      setConfirming(false);
      requestAnimationFrame(() => {
        document.getElementById(`shop-cosmetic-${item.id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
    }
    onFocusCosmeticConsumed?.();
  }, [focusCosmeticId, onFocusCosmeticConsumed]);

  if (!profile) return null;

  const showCustom = profile.avatar === 'custom' && Boolean(profile.customAvatarData);
  const avatarSrc = showCustom ? profile.customAvatarData! : DEFAULT_AVATAR;

  const closePreview = () => {
    setPreview(null);
    setConfirming(false);
  };

  const handleBuy = () => {
    if (!preview || busy) return;
    setBusy(true);
    const result = buyProfileCosmetic(preview.id as ProfileCosmeticId, true);
    setBusy(false);
    if (!result.ok) {
      playSound('wrong');
      if (result.reason === 'insufficient') {
        const need = Math.max(0, preview.price - getCoins());
        onToast?.(t('shopCosmeticNeedCoins', locale).replace('{n}', String(need)));
      }
      return;
    }
    playSound('powerUp');
    onToast?.(t('shopCosmeticOk', locale));
    onRefresh();
    closePreview();
  };

  const handleEquip = () => {
    if (!preview) return;
    if (equipCosmetic(preview.id as ProfileCosmeticId)) {
      playSound('profileUpdated');
      onRefresh();
      closePreview();
    }
  };

  const handleUnequip = () => {
    if (!preview) return;
    const ok =
      preview.type === 'bannerFrame'
        ? unequipBannerFrame()
        : preview.type === 'avatar'
          ? unequipFrame()
          : false;
    if (ok) {
      playSound('profileUpdated');
      onRefresh();
      closePreview();
    }
  };

  const previewBanner = preview?.type === 'banner' ? preview.id : equippedBanner;
  const previewBannerFrame =
    preview?.type === 'bannerFrame' ? preview.id : equippedBannerFrame;
  const previewAvatar = preview?.type === 'avatar' ? preview.id : equippedAvatar;
  const previewStatus = preview
    ? statusFor(preview, equippedBanner, equippedBannerFrame, equippedAvatar)
    : 'buy';

  return (
    <section className="shop-section shop-section--cosmetics">
      <h2 className="shop-section-title">{t('shopProfileSection', locale)}</h2>
      <p className="shop-section-hint">{t('shopProfileHint', locale)}</p>

      {sections.map((section) => (
        <div key={section.type} className="shop-cosmetic-cat">
          <h3 className="shop-cosmetic-cat-title">{t(section.titleKey, locale)}</h3>
          <div className="shop-cosmetic-grid" role="list">
            {section.items.map((item) => {
              const status = statusFor(item, equippedBanner, equippedBannerFrame, equippedAvatar);
              const { hero, avatar } = miniClasses(item, equippedBanner, equippedBannerFrame);
              const short =
                status === 'equipped'
                  ? t('shopCosmeticEquipped', locale)
                  : status === 'owned'
                    ? t('shopCosmeticOwned', locale)
                    : null;
              return (
                <button
                  key={item.id}
                  id={`shop-cosmetic-${item.id}`}
                  type="button"
                  className={`shop-cosmetic-card shop-cosmetic-card--${item.rarity}${status === 'equipped' ? ' shop-cosmetic-card--equipped' : ''}`}
                  onClick={() => {
                    playSound('tap');
                    setConfirming(false);
                    setPreview(item);
                  }}
                >
                  <div className={hero} aria-hidden="true">
                    <span className={avatar}>
                      <img src={avatarSrc} alt="" />
                    </span>
                  </div>
                  <span className="shop-cosmetic-name">{t(item.nameKey, locale)}</span>
                  <span className={`shop-cosmetic-rarity shop-cosmetic-rarity--${item.rarity}`}>
                    {t(rarityLabelKey(item.rarity), locale)}
                  </span>
                  <span className="shop-cosmetic-footer">
                    {status === 'buy' ? (
                      <span className="shop-cosmetic-price">
                        <LootCoin size={14} /> {item.price}
                      </span>
                    ) : (
                      <span className="shop-cosmetic-status">{short}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {preview && (
        <div className="shop-cosmetic-backdrop" role="presentation" onClick={closePreview}>
          <div
            className="shop-cosmetic-modal"
            role="dialog"
            aria-label={t('shopCosmeticPreview', locale)}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="shop-cosmetic-modal-title">{t(preview.nameKey, locale)}</p>
            <p className={`shop-cosmetic-rarity shop-cosmetic-rarity--${preview.rarity}`}>
              {t(rarityLabelKey(preview.rarity), locale)}
            </p>
            <div
              className={[
                'shop-cosmetic-preview-hero',
                'sp-profile-hero',
                `sp-profile-hero--${previewBanner}`,
                previewBannerFrame
                  ? `sp-profile-hero-frame sp-profile-hero-frame--${previewBannerFrame}`
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="sp-profile-hero-glow" />
              <div
                className={`shop-cosmetic-preview-avatar${
                  previewAvatar ? ` sp-profile-frame sp-profile-frame--${previewAvatar}` : ''
                }`}
              >
                <img
                  src={avatarSrc}
                  alt=""
                  className={`sp-profile-avatar-img${showCustom ? '' : ' sp-profile-avatar-img--mascot'}`}
                />
              </div>
              <p className="shop-cosmetic-preview-name">{profile.displayName}</p>
            </div>

            {previewStatus === 'buy' && (
              <>
                {coins < preview.price ? (
                  <p className="shop-cosmetic-need">
                    {t('shopCosmeticNeedCoins', locale).replace(
                      '{n}',
                      String(preview.price - coins),
                    )}
                  </p>
                ) : confirming ? (
                  <p className="shop-cosmetic-confirm-hint">
                    {t('shopCosmeticConfirmHint', locale)
                      .replace('{name}', t(preview.nameKey, locale))
                      .replace('{price}', String(preview.price))}
                  </p>
                ) : null}
                {!confirming ? (
                  <button
                    type="button"
                    className="btn-primary btn-lg"
                    disabled={coins < preview.price || busy}
                    onClick={() => setConfirming(true)}
                  >
                    {t('shopCosmeticBuy', locale)}
                    <span className="shop-buy-price">
                      <LootCoin size={14} /> {preview.price}
                    </span>
                  </button>
                ) : (
                  <div className="shop-cosmetic-confirm-row">
                    <button
                      type="button"
                      className="btn-primary btn-lg"
                      disabled={coins < preview.price || busy}
                      onClick={handleBuy}
                    >
                      {t('shopCosmeticConfirm', locale)}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
                      {t('cancel', locale)}
                    </button>
                  </div>
                )}
              </>
            )}

            {previewStatus === 'owned' && (
              <button type="button" className="btn-primary btn-lg" onClick={handleEquip}>
                {t('shopCosmeticEquip', locale)}
              </button>
            )}

            {previewStatus === 'equipped' && (
              <>
                <p className="shop-cosmetic-status">{t('shopCosmeticEquipped', locale)}</p>
                {(preview.type === 'avatar' || preview.type === 'bannerFrame') && (
                  <button type="button" className="btn-secondary" onClick={handleUnequip}>
                    {preview.type === 'avatar'
                      ? t('shopCosmeticUnequip', locale)
                      : t('shopCosmeticUnequipBannerFrame', locale)}
                  </button>
                )}
              </>
            )}

            <button type="button" className="btn-ghost" onClick={closePreview}>
              {t('gotIt', locale)}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
