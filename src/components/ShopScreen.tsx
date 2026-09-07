import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AdSenseSlot } from './AdSenseSlot';
import { BrandDecor } from './BrandDecor';
import { DailyChestOverlay } from './DailyChestOverlay';
import { ScanPlayChest } from './ScanPlayChest';
import { AchievementGlyph } from './icons/AchievementGlyph';
import { EconomyGlyph, LootCoin, LootGem, LootScan, LootXp } from './icons/EconomyIcons';
import { RewardedAdSheet } from './RewardedAdSheet';
import { grantAdConsent } from '../lib/ads/consent';
import {
  ADSENSE_UI_PAUSED,
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
  buyTranslateHint,
  buyXpPack,
  buyXpPotion,
  canBuyExtraScanInShop,
  convertGemToCoins,
  GEM_COIN_RATE,
  getAdWatchesLeftToday,
  getCoins,
  getGems,
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
  SHOP_TRANSLATE_HINT_PRICE,
  EXTRA_SCAN_PRICE,
  type ChestReward,
  type ShopPurchaseResult,
} from '../lib/shop';
import {
  getTranslateHints,
  getXpBoostMinutesLeft,
  isXpBoostActive,
  streakRestoreHoursLeft,
  streakRestorePrice,
} from '../lib/wallet';
import { playSound } from '../lib/sounds';
import { notifyShopPurchase } from '../lib/notifications';
import { t, type TranslationKey } from '../lib/i18n';
import type { Locale } from '../types';
import { NotificationCenter } from './NotificationCenter';

interface ShopScreenProps {
  locale: Locale;
  refreshKey: number;
  onRefresh: () => void;
  onNewUnlocks?: (unlocks: import('../lib/achievements').AchievementDef[]) => void;
  onToast?: (message: string) => void;
  onSocialChange?: () => void;
}

interface ShopItemRowProps {
  locale: Locale;
  icon: ReactNode;
  nameKey: TranslationKey;
  desc: string;
  price: number;
  buyId: string;
  busy: string | null;
  popping?: boolean;
  disabled?: boolean;
  highlight?: boolean;
  extra?: ReactNode;
  tone?: string;
  priceKind?: 'coins' | 'gems';
  buyLabel?: string;
  onBuy: () => void;
}

function ShopBuyButton({
  locale,
  price,
  disabled,
  loading,
  priceKind = 'coins',
  buyLabel,
  onClick,
}: {
  locale: Locale;
  price: number;
  disabled?: boolean;
  loading?: boolean;
  priceKind?: 'coins' | 'gems';
  buyLabel?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="btn-primary shop-buy-btn" disabled={disabled || loading} onClick={onClick}>
      {loading ? '…' : (buyLabel ?? t('shopBuy', locale))}
      {!loading && (
        <span className="shop-buy-price">
          {priceKind === 'gems' ? <LootGem size={14} /> : <LootCoin size={14} />} {price}
        </span>
      )}
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
  popping,
  disabled,
  highlight,
  extra,
  tone,
  priceKind = 'coins',
  buyLabel,
  onBuy,
}: ShopItemRowProps) {
  const cannotAfford = priceKind === 'gems' ? getGems() < price : coinsBelow(price);
  return (
    <article
      className={`shop-item shop-item--shelf${highlight ? ' shop-item--highlight' : ''}${tone ? ` shop-item--${tone}` : ''}${popping ? ' shop-item--pop' : ''}`}
    >
      <span className="shop-item-icon shop-item-icon--lg" aria-hidden="true">
        <span className="shop-item-spark shop-item-spark--a" />
        <span className="shop-item-spark shop-item-spark--b" />
        <span className="shop-item-spark shop-item-spark--c" />
        {icon}
      </span>
      <p className="shop-item-name">{t(nameKey, locale)}</p>
      <p className="shop-item-desc">{desc}</p>
      {extra}
      <ShopBuyButton
        locale={locale}
        price={price}
        disabled={disabled || cannotAfford}
        loading={busy === buyId}
        priceKind={priceKind}
        buyLabel={buyLabel}
        onClick={onBuy}
      />
    </article>
  );
}

function coinsBelow(price: number): boolean {
  return getCoins() < price;
}

const SHOP_NOTIF_ICON: Record<string, string> = {
  potion: 'potion',
  mega: 'megaPotion',
  gems: 'gem',
  xppack: 'xp',
  streak: 'streak',
  scan: 'scan',
  synthesis: 'synthesis',
  hint: 'hint',
  freeze: 'freeze',
  ad: 'coin',
};

export function ShopScreen({ locale, refreshKey, onRefresh, onNewUnlocks, onToast, onSocialChange }: ShopScreenProps) {
  void refreshKey;
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [chestReward, setChestReward] = useState<ChestReward | null>(null);
  const [chestOverlayOpen, setChestOverlayOpen] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [rewardedOpen, setRewardedOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [popId, setPopId] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const popTimer = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (popTimer.current != null) window.clearTimeout(popTimer.current);
    };
  }, []);

  const shopAdSlot = getAdSenseShopSlot();
  const adsLive = isAdSenseEnabled() && shopAdSlot != null;

  const coins = getCoins();
  const gems = getGems();
  const plan = getPlan();
  const restorable = getRestorableStreak();
  const restorePrice = getStreakRestoreShopPrice();
  const restoreHours = streakRestoreHoursLeft();
  const boostActive = isXpBoostActive();
  const boostMin = getXpBoostMinutesLeft();
  const chestReady = canClaimDailyChest();
  const adsLeft = getAdWatchesLeftToday();
  const freezeCharges = getStreakFreezeCharges();
  const translateHints = getTranslateHints();
  const synthesisBonus = getSynthesisBonusCredits();
  const extraScanOk = canBuyExtraScanInShop();

  const run = async (id: string, fn: () => ShopPurchaseResult | Promise<ShopPurchaseResult>, successKey?: TranslationKey) => {
    setError(null);
    setInfo(null);
    setBusy(id);
    try {
      const result = await fn();
      if (!result.ok) {
        setError(t(id === 'gems' && result.reason === 'insufficient' ? 'shopNotEnoughGems' : mapReason(result.reason), locale));
        playSound('wrong');
        return;
      }
      const message = successKey
        ? t(successKey, locale).replace('{coins}', String(GEM_COIN_RATE))
        : t('shopPurchaseOk', locale);
      setInfo(message);
      onToast?.(message);
      notifyShopPurchase(SHOP_NOTIF_ICON[id] ?? 'coin', message);
      playSound('powerUp');
      window.setTimeout(() => playSound('coinPop'), 90);
      setPopId(id);
      if (popTimer.current != null) window.clearTimeout(popTimer.current);
      popTimer.current = window.setTimeout(() => {
        if (mountedRef.current) setPopId(null);
      }, 920);
      onRefresh();
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const handleChest = () => {
    if (!chestReady || busy === 'chest') return;
    setError(null);
    setInfo(null);
    setChestReward(null);
    setChestOverlayOpen(true);
  };

  const handleChestOpened = (reward: ChestReward, _rarity?: import('../lib/chestRarity').ChestRarity) => {
    setChestReward(reward);
    const msg = t('chestOpened', locale);
    setInfo(msg);
    onToast?.(msg);
    notifyShopPurchase('path', msg);
    onRefresh();
  };

  const closeChestOverlay = () => {
    setChestOverlayOpen(false);
  };

  const handleAd = async () => {
    if (adLoading || busy === 'ad' || rewardedOpen || !canWatchAdForCoins()) return;

    if (isAdSimulationMode()) {
      setAdLoading(true);
      try {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 1500));
        await run('ad', () => watchAdForCoins(), 'shopAdRewardDone');
      } finally {
        if (mountedRef.current) setAdLoading(false);
      }
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
      <BrandDecor />
      <header className="top-bar">
        <h2 className="screen-title">{t('shopTitle', locale)}</h2>
        <div className="shop-balances">
          <span className="shop-balance shop-balance--coins" aria-label={t('coins', locale)}>
            <LootCoin size={18} /> {coins}
          </span>
          <span className="shop-balance shop-balance--gems" aria-label={t('dashGems', locale)}>
            <LootGem size={18} /> {gems}
          </span>
          <NotificationCenter locale={locale} refreshKey={refreshKey} onSocialChange={onSocialChange} />
        </div>
      </header>

      <main className="shop-main scroll-natural">
        {error && <p className="shop-msg shop-msg--error">{error}</p>}
        {info && <p className="shop-msg shop-msg--ok">{info}</p>}

        <section className="shop-section">
          <h2 className="shop-section-title">{t('shopDailyChest', locale)}</h2>
          <div className="shop-chest-card">
            <ScanPlayChest open={!chestReady} size={96} className="shop-chest-art" idle={chestReady} />
            <p className="shop-chest-desc">{t('shopDailyChestHint', locale)}</p>
            {chestReward && (
              <p className="shop-chest-reward">
                {chestReward.type === 'coins' ? (
                  <>
                    <EconomyGlyph id="coin" size={16} /> +{chestReward.amount}
                  </>
                ) : chestReward.type === 'xp' ? (
                  <>
                    <EconomyGlyph id="xp" size={16} /> +{chestReward.amount} XP
                  </>
                ) : chestReward.type === 'gems' ? (
                  <>
                    <EconomyGlyph id="gem" size={16} /> +{chestReward.amount}
                  </>
                ) : chestReward.type === 'achievement' ? (
                  <>
                    <AchievementGlyph achievement={chestReward.achievement} size={16} />{' '}
                    {t(chestReward.achievement.nameKey, locale)}
                  </>
                ) : (
                  <>
                    <EconomyGlyph id="potion" size={16} /> {t(chestReward.labelKey, locale)}
                  </>
                )}
              </p>
            )}
            <button
              type="button"
              className={`btn-primary${chestReady ? '' : ' dash-chest-btn--done'}`}
              disabled={!chestReady || chestOverlayOpen}
              onClick={handleChest}
            >
              {chestReady ? t('shopOpenChest', locale) : t('shopChestDone', locale)}
            </button>
          </div>
        </section>

        <section className="shop-section">
          <h2 className="shop-section-title">{t('shopExchange', locale)}</h2>
          <div className="shop-shelf">
            <ShopItemRow
              locale={locale}
              icon={<LootGem size={44} />}
              nameKey="shopGemConvert"
              desc={t('shopGemConvertDesc', locale).replace('{coins}', String(GEM_COIN_RATE))}
              price={1}
              priceKind="gems"
              buyLabel={t('shopConvert', locale)}
              buyId="gems"
              busy={busy}
              popping={popId === 'gems'}
              tone="gem"
              onBuy={() => void run('gems', () => convertGemToCoins(1), 'shopGemConvertOk')}
            />
          </div>
        </section>

        <section className="shop-section">
          <h2 className="shop-section-title">{t('shopBoosts', locale)}</h2>
          <div className="shop-shelf">

          <ShopItemRow
            locale={locale}
            icon={<EconomyGlyph id="potion" size={44} />}
            nameKey="shopXpPotion"
            desc={t('shopXpPotionDesc', locale)}
            price={SHOP_XP_POTION_PRICE}
            buyId="potion"
            busy={busy}
            popping={popId === 'potion'}
            tone="potion"
            onBuy={() => void run('potion', () => buyXpPotion())}
            extra={
              boostActive ? (
                <p className="shop-item-active">{t('shopBoostActive', locale).replace('{min}', String(boostMin))}</p>
              ) : undefined
            }
          />

          <ShopItemRow
            locale={locale}
            icon={<EconomyGlyph id="megaPotion" size={44} />}
            nameKey="shopMegaPotion"
            desc={t('shopMegaPotionDesc', locale).replace('{min}', String(SHOP_MEGA_POTION_MINUTES))}
            price={SHOP_MEGA_POTION_PRICE}
            buyId="mega"
            busy={busy}
            popping={popId === 'mega'}
            tone="mega"
            onBuy={() => void run('mega', () => buyMegaXpPotion())}
          />

          <ShopItemRow
            locale={locale}
            icon={<LootXp size={44} />}
            nameKey="shopXpPack"
            desc={t('shopXpPackDesc', locale).replace('{xp}', String(SHOP_XP_PACK_AMOUNT))}
            price={SHOP_XP_PACK_PRICE}
            buyId="xppack"
            busy={busy}
            popping={popId === 'xppack'}
            tone="xp"
            onBuy={() => void run('xppack', () => buyXpPack(), 'shopXpPackOk')}
          />

          {restorable > 0 && (
            <ShopItemRow
              locale={locale}
              icon={<EconomyGlyph id="streak" size={44} />}
              nameKey="shopStreakRestore"
              desc={t('shopStreakRestoreDesc', locale)
                .replace('{days}', String(restorable))
                .replace('{hours}', String(restoreHours))}
              price={restorePrice}
              buyId="streak"
              busy={busy}
              popping={popId === 'streak'}
              tone="streak"
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
          </div>
        </section>

        <section className="shop-section">
          <h2 className="shop-section-title">{t('shopUtilities', locale)}</h2>
          <div className="shop-shelf">

          {plan === 'free' && (
            <ShopItemRow
              locale={locale}
              icon={<LootScan size={44} />}
              nameKey="shopExtraScan"
              desc={
                extraScanOk
                  ? t('shopExtraScanDesc', locale)
                  : t('shopExtraScanLimit', locale)
              }
              price={EXTRA_SCAN_PRICE}
              buyId="scan"
              busy={busy}
              popping={popId === 'scan'}
              tone="scan"
              disabled={!extraScanOk}
              onBuy={() => void run('scan', () => buyExtraScan(), 'shopExtraScanOk')}
            />
          )}

          <ShopItemRow
            locale={locale}
            icon={<EconomyGlyph id="synthesis" size={44} />}
            nameKey="shopSynthesisCredit"
            desc={t('shopSynthesisCreditDesc', locale)}
            price={SHOP_SYNTHESIS_CREDIT_PRICE}
            buyId="synthesis"
            busy={busy}
            popping={popId === 'synthesis'}
            tone="synth"
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
            icon={<EconomyGlyph id="hint" size={44} />}
            nameKey="shopTranslateHint"
            desc={t('shopTranslateHintDesc', locale)}
            price={SHOP_TRANSLATE_HINT_PRICE}
            buyId="hint"
            busy={busy}
            popping={popId === 'hint'}
            tone="hint"
            onBuy={() => void run('hint', () => buyTranslateHint(), 'shopTranslateHintOk')}
            extra={
              translateHints > 0 ? (
                <p className="shop-item-active">
                  {t('shopTranslateHintOwned', locale).replace('{n}', String(translateHints))}
                </p>
              ) : undefined
            }
          />

          <ShopItemRow
            locale={locale}
            icon={<EconomyGlyph id="freeze" size={44} />}
            nameKey="shopStreakFreeze"
            desc={t('shopStreakFreezeDesc', locale)}
            price={SHOP_STREAK_FREEZE_PRICE}
            buyId="freeze"
            busy={busy}
            popping={popId === 'freeze'}
            tone="freeze"
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
          </div>
        </section>

        {!ADSENSE_UI_PAUSED && (
        <section className="shop-section">
          <h2 className="shop-section-title">{t('shopFreeCoins', locale)}</h2>
          {adsLive && <p className="shop-ad-support-hint">{t('shopAdSupportHint', locale)}</p>}
          {isAdSimulationMode() && <p className="shop-ad-dev-hint">{t('shopAdDevHint', locale)}</p>}
          <div className={`shop-item shop-item--ad${popId === 'ad' ? ' shop-item--pop' : ''}`}>
            <div className="shop-item-info">
              <span className="shop-item-icon">
                <EconomyGlyph id="coin" size={28} />
              </span>
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
        )}
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
        onNewUnlocks={onNewUnlocks}
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
