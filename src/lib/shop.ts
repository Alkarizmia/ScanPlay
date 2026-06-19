import {
  activateXpBoost,
  addCoins,
  canBuyExtraScan,
  canClaimDailyChest,
  canWatchAdForCoins,
  EXTRA_SCAN_PRICE,
  getAdWatchesLeftToday,
  getCoins,
  getRestorableStreak,
  getStreakFreezeCharges,
  getSynthesisBonusCredits,
  grantStreakFreezeCharge,
  grantSynthesisBonusCredit,
  markDailyChestClaimed,
  purchaseExtraScan,
  recordAdReward,
  restoreLostStreak,
  spendCoins,
  streakRestorePrice,
  XP_BOOST_DURATION_MS,
  type SpendResult,
} from './wallet';
import { getNewUnlocksSince, recordUnlocks, snapshotUnlockedIds } from './achievementUnlocks';
import { addBonusXp } from './gamification';
import { getPlan } from './planLimits';
import type { AchievementDef } from './achievements';
import type { TranslationKey } from './i18n';

export const SHOP_XP_POTION_PRICE = 80;
export const SHOP_XP_POTION_MINUTES = 15;
export const SHOP_XP_PACK_PRICE = 35;
export const SHOP_XP_PACK_AMOUNT = 75;
export const SHOP_MEGA_POTION_PRICE = 140;
export const SHOP_MEGA_POTION_MINUTES = 30;
export const SHOP_SYNTHESIS_CREDIT_PRICE = 90;
export const SHOP_STREAK_FREEZE_PRICE = 100;
export const SHOP_STREAK_FREEZE_MAX = 3;

export type ShopPurchaseResult =
  | { ok: true }
  | { ok: false; reason: 'insufficient' | 'not_logged_in' | 'unavailable' | 'already_claimed' | 'limit_reached' };

function fromSpend(result: SpendResult): ShopPurchaseResult {
  if (result.ok) return result;
  return { ok: false, reason: result.reason };
}

export type ChestReward =
  | { type: 'coins'; amount: number; labelKey: TranslationKey }
  | { type: 'xp'; amount: number; labelKey: TranslationKey }
  | { type: 'xp_potion'; minutes: number; labelKey: TranslationKey }
  | { type: 'achievement'; achievement: AchievementDef; labelKey: TranslationKey };

const CHEST_POOL: ChestReward[] = [
  { type: 'coins', amount: 15, labelKey: 'chestRewardCoins' },
  { type: 'coins', amount: 25, labelKey: 'chestRewardCoins' },
  { type: 'coins', amount: 40, labelKey: 'chestRewardBigCoins' },
  { type: 'xp', amount: 30, labelKey: 'chestRewardXp' },
  { type: 'xp', amount: 50, labelKey: 'chestRewardXp' },
  { type: 'xp_potion', minutes: 15, labelKey: 'chestRewardPotion' },
  { type: 'coins', amount: 60, labelKey: 'chestRewardBigCoins' },
];

function rollAchievementChestReward(): ChestReward {
  const before = snapshotUnlockedIds();
  const pending = getNewUnlocksSince(before);
  if (pending.length > 0) {
    const achievement = pending[Math.floor(Math.random() * pending.length)]!;
    return { type: 'achievement', achievement, labelKey: 'chestRewardAchievement' };
  }
  return { type: 'xp', amount: 45, labelKey: 'chestRewardXp' };
}

export function buyXpPotion(): ShopPurchaseResult {
  const spent = spendCoins(SHOP_XP_POTION_PRICE);
  if (!spent.ok) return fromSpend(spent);
  activateXpBoost(XP_BOOST_DURATION_MS);
  return { ok: true };
}

export function buyMegaXpPotion(): ShopPurchaseResult {
  const spent = spendCoins(SHOP_MEGA_POTION_PRICE);
  if (!spent.ok) return fromSpend(spent);
  activateXpBoost(SHOP_MEGA_POTION_MINUTES * 60 * 1000);
  return { ok: true };
}

export function buyXpPack(): ShopPurchaseResult {
  const spent = spendCoins(SHOP_XP_PACK_PRICE);
  if (!spent.ok) return fromSpend(spent);
  addBonusXp(SHOP_XP_PACK_AMOUNT);
  return { ok: true };
}

export function buyExtraScan(): ShopPurchaseResult {
  if (getPlan() !== 'free') return { ok: false, reason: 'unavailable' };
  if (!canBuyExtraScan()) return { ok: false, reason: 'limit_reached' };
  const result = purchaseExtraScan();
  if (!result.ok) return fromSpend(result);
  return { ok: true };
}

export function canBuyExtraScanInShop(): boolean {
  return getPlan() === 'free' && canBuyExtraScan();
}

export function buySynthesisCredit(): ShopPurchaseResult {
  const spent = spendCoins(SHOP_SYNTHESIS_CREDIT_PRICE);
  if (!spent.ok) return fromSpend(spent);
  grantSynthesisBonusCredit();
  return { ok: true };
}

export function buyStreakFreeze(): ShopPurchaseResult {
  if (getStreakFreezeCharges() >= SHOP_STREAK_FREEZE_MAX) {
    return { ok: false, reason: 'limit_reached' };
  }
  const spent = spendCoins(SHOP_STREAK_FREEZE_PRICE);
  if (!spent.ok) return fromSpend(spent);
  grantStreakFreezeCharge();
  return { ok: true };
}

export function buyStreakRestore(): ShopPurchaseResult {
  const streak = getRestorableStreak();
  if (streak <= 0) return { ok: false, reason: 'unavailable' };
  const restored = restoreLostStreak();
  if (!restored.ok) return fromSpend(restored);
  return { ok: true };
}

export function getStreakRestoreShopPrice(): number {
  return streakRestorePrice(getRestorableStreak());
}

export function rollDailyChest(): ChestReward {
  if (Math.random() < 0.14) {
    return rollAchievementChestReward();
  }
  const idx = Math.floor(Math.random() * CHEST_POOL.length);
  return CHEST_POOL[idx] ?? CHEST_POOL[0]!;
}

export function claimDailyChest(): { ok: true; reward: ChestReward } | { ok: false; reason: 'already_claimed' } {
  if (!canClaimDailyChest()) return { ok: false, reason: 'already_claimed' };
  const reward = rollDailyChest();
  markDailyChestClaimed();

  if (reward.type === 'coins') {
    addCoins(reward.amount);
  } else if (reward.type === 'xp') {
    addBonusXp(reward.amount);
  } else if (reward.type === 'xp_potion') {
    activateXpBoost(reward.minutes * 60 * 1000);
  } else if (reward.type === 'achievement') {
    const before = snapshotUnlockedIds();
    const fresh = getNewUnlocksSince(before);
    if (fresh.some((a) => a.id === reward.achievement.id)) {
      recordUnlocks([reward.achievement.id]);
    } else {
      addBonusXp(40);
    }
  }

  return { ok: true, reward };
}

export function watchAdForCoins(): ShopPurchaseResult {
  if (!canWatchAdForCoins()) return { ok: false, reason: 'unavailable' };
  recordAdReward();
  return { ok: true };
}

export {
  getCoins,
  getRestorableStreak,
  canClaimDailyChest,
  canWatchAdForCoins,
  getAdWatchesLeftToday,
  getStreakFreezeCharges,
  getSynthesisBonusCredits,
  EXTRA_SCAN_PRICE,
};
