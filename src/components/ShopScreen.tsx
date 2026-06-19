import { useState, type ReactNode } from 'react';
import { AdSenseSlot } from './AdSenseSlot';
import { DailyChestOverlay } from './DailyChestOverlay';
import { RewardedAdSheet } from './RewardedAdSheet';
import { grantAdConsent } from '../lib/ads/consent';
import {
  getAdSenseShopSlot,
  isAdSenseEnabled,
  isAdSimulationMode,
} from '../lib/ads/config';
import { getPlan } from '../lib/planLimits';
import {
  buyExtraScan,
  buyMegaXpPotion,
  buyStreakFreeze,
  buyStreakRestore,
  buySynthesisCredit,
  buyXpPack,
  buyXpPotion,
  canBuyExtraScanInShop,
  getAdWatchesLeftToday,
  getCoins,
  getRestorableStreak,
  getStreakFreezeCharges,
  getStreakRestoreShopPrice,
  getSynthesisBonusCredits,
  canClaimDailyChest,
  canWatchAdForCoins,
  watchAdForCoins,
  SHOP_XP_POTION_PRICE,
  SHOP_XP_PACK_PRICE,
  SHOP_XP_PACK_AMOUNT,
  SHOP_MEGA_POTION_PRICE,
  SHOP_MEGA_POTION_MINUTES,
  SHOP_SYNTHESIS_CREDIT_PRICE,
  SHOP_STREAK_FREEZE_PRICE,
  SHOP_STREAK_FREEZE_MAX,
  EXTRA_SCAN_PRICE,
  type ChestReward,
  type ShopPurchaseResult,
} from '../lib/shop';
import {
  getXpBoostMinutesLeft,
  isXpBoostActive,
  streakRestoreHoursLeft,
  streakRestorePrice,
} from '../lib/wallet';
import { playSound } from '../lib/sounds';
import { t, type TranslationKey } from '../lib/i18n';
import type { Locale } from '../types';

interface ShopScreenProps {
  locale: Locale;
  refreshKey: number;
  onRefresh: () => void;
}

interface ShopItemRowProps {
  locale: Locale;
  icon: string;
  nameKey: TranslationKey;
  desc: string;
  price: number;
  buyId: string;
  busy: string | null;
  disabled?: boolean;
  highlight?: boolean;
  extra?: ReactNode;
  onBuy: () => void;
}

function ShopBuyButton({
  locale,
  price,
  disabled,
  loading,
  onClick,
}: {
  locale: Locale;
  price: number;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="btn-primary shop-buy-btn" disabled={disabled || loading} onClick={onClick}>
      {loading ? '…' : t('shopBuy', locale)}
      {!loading && <span className="shop-buy-price">🪙 {price}</span>}
    </button>
  );
}

function ShopItemRow({
  locale,
  icon,
  nameKey,
  desc,
  price,
  buyId,
  busy,
  disabled,
  highlight,
  extra,
  onBuy,
}: ShopItemRowProps) {
  return (
    <div className={`shop-item${highlight ? ' shop-item--highlight' : ''}`}>
      <div className="shop-item-info">
        <span className="shop-item-icon">{icon}</span>
        <div>
          <p className="shop-item-name">{t(nameKey, locale)}</p>
          <p className="shop-item-desc">{desc}</p>
          {extra}
        </div>
      </div>
      <ShopBuyButton
        locale={locale}
        price={price}
        disabled={disabled || coinsBelow(price)}
        loading={busy === buyId}
        onClick={onBuy}
      />
    </div>
  );
}

function coinsBelow(price: number): boolean {
  return getCoins() < price;
}

export function ShopScreen({ locale, refreshKey, onRefresh }: ShopScreenProps) {
  void refreshKey;
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [chestReward, setChestReward] = useState<ChestReward | null>(null);
  const [chestOverlayOpen, setChestOverlayOpen] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [rewardedOpen, setRewardedOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const shopAdSlot = getAdSenseShopSlot();
  const adsLive = isAdSenseEnabled() && shopAdSlot != null;

  const coins = getCoins();
  const plan = getPlan();
  const restorable = getRestorableStreak();
  const restorePrice = getStreakRestoreShopPrice();
  const restoreHours = streakRestoreHoursLeft();
  const boostActive = isXpBoostActive();
  const boostMin = getXpBoostMinutesLeft();
  const chestReady = canClaimDailyChest();
  const adsLeft = getAdWatchesLeftToday();
  const freezeCharges = getStreakFreezeCharges();
  const synthesisBonus = getSynthesisBonusCredits();
  const extraScanOk = canBuyExtraScanInShop();

  const run = async (id: string, fn: () => ShopPurchaseResult | Promise<ShopPurchaseResult>, successKey?: TranslationKey) => {
    setError(null);
    setInfo(null);
    setBusy(id);
    const result = await fn();
    setBusy(null);
    if (!result.ok) {
      setError(t(mapReason(result.reason), locale));
      return;
    }
    if (successKey) setInfo(t(successKey, locale));
    else setInfo(t('shopPurchaseOk', locale));
    playSound('xpGain');
    onRefresh();
  };

  const handleChest = () => {
    if (!chestReady || busy === 'chest') return;
    setError(null);
    setInfo(null);
    setChestReward(null);
    setChestOverlayOpen(true);
  };

  const handleChestOpened = (reward: ChestReward) => {
    setChestReward(reward);
    setInfo(t('chestOpened', locale));
    onRefresh();
  };

  const closeChestOverlay = () => {
    setChestOverlayOpen(false);
  };

  const handleAd = () => {
    if (isAdSimulationMode()) {
      setAdLoading(true);
      window.setTimeout(() => {
        void run('ad', () => watchAdForCoins(), 'shopAdRewardDone').finally(() => setAdLoading(false));
      }, 2200);
      return;
    }
    grantAdConsent();
    setRewardedOpen(true);
  };

  const handleAdReward = () => {
    void run('ad', () => watchAdForCoins(), 'shopAdRewardDone');
  };

  return (
    <div className="screen tab-screen shop-screen">
      <header className="top-bar">
        <h2 className="screen-title">{t('shopTitle', locale)}</h2>
        <span className="shop-balance" aria-label={t('coins', locale)}>
          🪙 {coins}
        </span>
      </header>

      <main className="shop-main scroll-natural">
        {error && <p className="shop-msg shop-msg--error">{error}</p>}
        {info && <p className="shop-msg shop-msg--ok">{info}</p>}

        <section className="shop-section">
          <h2 className="shop-section-title">{t('shopDailyChest', locale)}</h2>
          <div className="shop-chest-card">
            <span className="shop-chest-icon" aria-hidden="true">
              🎁
            </span>
            <p className="shop-chest-desc">{t('shopDailyChestHint', locale)}</p>
            {chestReward && (
              <p className="shop-chest-reward">
                {chestReward.type === 'coins' ? (
                  <>🪙 +{chestReward.amount}</>
                ) : chestReward.type === 'achievement' ? (
                  <>
                    {chestReward.achievement.icon} {t(chestReward.achievement.nameKey, locale)}
                  </>
                ) : (
                  t(chestReward.labelKey, locale)
                )}
              </p>
            )}
            <button
              type="button"
              className="btn-primary"
              disabled={!chestReady || chestOverlayOpen}
              onClick={handleChest}
            >
              {chestReady ? t('shopOpenChest', locale) : t('shopChestDone', locale)}
            </button>
          </div>
        </section>

        <section className="shop-section">
          <h2 className="shop-section-title">{t('shopBoosts', locale)}</h2>

          <ShopItemRow
            locale={locale}
            icon="⚗️"
            nameKey="shopXpPotion"
            desc={t('shopXpPotionDesc', locale)}
            price={SHOP_XP_POTION_PRICE}
            buyId="potion"
            busy={busy}
            onBuy={() => void run('potion', () => buyXpPotion())}
            extra={
              boostActive ? (
                <p className="shop-item-active">{t('shopBoostActive', locale).replace('{min}', String(boostMin))}</p>
              ) : undefined
            }
          />

          <ShopItemRow
            locale={locale}
            icon="🧪"
            nameKey="shopMegaPotion"
            desc={t('shopMegaPotionDesc', locale).replace('{min}', String(SHOP_MEGA_POTION_MINUTES))}
            price={SHOP_MEGA_POTION_PRICE}
            buyId="mega"
            busy={busy}
            onBuy={() => void run('mega', () => buyMegaXpPotion())}
          />

          <ShopItemRow
            locale={locale}
            icon="⚡"
            nameKey="shopXpPack"
            desc={t('shopXpPackDesc', locale).replace('{xp}', String(SHOP_XP_PACK_AMOUNT))}
            price={SHOP_XP_PACK_PRICE}
            buyId="xppack"
            busy={busy}
            onBuy={() => void run('xppack', () => buyXpPack(), 'shopXpPackOk')}
          />

          {restorable > 0 && (
            <ShopItemRow
              locale={locale}
              icon="🔥"
              nameKey="shopStreakRestore"
              desc={t('shopStreakRestoreDesc', locale)
                .replace('{days}', String(restorable))
                .replace('{hours}', String(restoreHours))}
              price={restorePrice}
              buyId="streak"
              busy={busy}
              highlight
              disabled={coins < restorePrice}
              onBuy={() => void run('streak', () => buyStreakRestore(), 'shopStreakRestoreOk')}
              extra={
                <p className="shop-item-note">
                  {t('shopStreakPriceScale', locale).replace('{price100}', String(streakRestorePrice(100)))}
                </p>
              }
            />
          )}
        </section>

        <section className="shop-section">
          <h2 className="shop-section-title">{t('shopUtilities', locale)}</h2>

          {plan === 'free' && (
            <ShopItemRow
              locale={locale}
              icon="📷"
              nameKey="shopExtraScan"
              desc={
                extraScanOk
                  ? t('shopExtraScanDesc', locale)
                  : t('shopExtraScanLimit', locale)
              }
              price={EXTRA_SCAN_PRICE}
              buyId="scan"
              busy={busy}
              disabled={!extraScanOk}
              onBuy={() => void run('scan', () => buyExtraScan(), 'shopExtraScanOk')}
            />
          )}

          <ShopItemRow
            locale={locale}
            icon="✨"
            nameKey="shopSynthesisCredit"
            desc={t('shopSynthesisCreditDesc', locale)}
            price={SHOP_SYNTHESIS_CREDIT_PRICE}
            buyId="synthesis"
            busy={busy}
            onBuy={() => void run('synthesis', () => buySynthesisCredit(), 'shopSynthesisCreditOk')}
            extra={
              synthesisBonus > 0 ? (
                <p className="shop-item-active">
                  {t('shopSynthesisBonusOwned', locale).replace('{n}', String(synthesisBonus))}
                </p>
              ) : undefined
            }
          />

          <ShopItemRow
            locale={locale}
            icon="🛡️"
            nameKey="shopStreakFreeze"
            desc={t('shopStreakFreezeDesc', locale)}
            price={SHOP_STREAK_FREEZE_PRICE}
            buyId="freeze"
            busy={busy}
            disabled={freezeCharges >= SHOP_STREAK_FREEZE_MAX}
            onBuy={() => void run('freeze', () => buyStreakFreeze(), 'shopStreakFreezeOk')}
            extra={
              freezeCharges > 0 ? (
                <p className="shop-item-active">
                  {t('shopStreakFreezeOwned', locale).replace('{n}', String(freezeCharges))}
                </p>
              ) : undefined
            }
          />
        </section>

        <section className="shop-section">
          <h2 className="shop-section-title">{t('shopFreeCoins', locale)}</h2>
          {adsLive && <p className="shop-ad-support-hint">{t('shopAdSupportHint', locale)}</p>}
          {isAdSimulationMode() && <p className="shop-ad-dev-hint">{t('shopAdDevHint', locale)}</p>}
          <div className="shop-item">
            <div className="shop-item-info">
              <span className="shop-item-icon">📺</span>
              <div>
                <p className="shop-item-name">{t('shopWatchAd', locale)}</p>
                <p className="shop-item-desc">
                  {t('shopWatchAdDesc', locale).replace('{left}', String(adsLeft))}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary shop-buy-btn"
              disabled={!canWatchAdForCoins() || adLoading || busy === 'ad' || rewardedOpen}
              onClick={handleAd}
            >
              {adLoading ? t('shopAdLoading', locale) : t('shopWatchAdBtn', locale)}
            </button>
          </div>
          {adsLive && shopAdSlot && !rewardedOpen && (
            <AdSenseSlot
              slotId={shopAdSlot}
              label={t('shopAdLabel', locale)}
              consentHint={t('shopAdCmpWait', locale)}
              emptyHint={t('shopAdEmptyFill', locale)}
            />
          )}
        </section>
      </main>

      <RewardedAdSheet
        open={rewardedOpen}
        locale={locale}
        onClose={() => setRewardedOpen(false)}
        onReward={handleAdReward}
      />

      <DailyChestOverlay
        open={chestOverlayOpen}
        locale={locale}
        onClose={closeChestOverlay}
        onOpened={handleChestOpened}
      />
    </div>
  );
}

function mapReason(reason?: string): TranslationKey {
  switch (reason) {
    case 'insufficient':
      return 'shopNotEnoughCoins';
    case 'already_claimed':
      return 'shopChestAlready';
    case 'limit_reached':
      return 'shopLimitReached';
    case 'unavailable':
      return 'shopUnavailable';
    default:
      return 'shopError';
  }
}
