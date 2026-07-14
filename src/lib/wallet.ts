import { isLoggedIn } from './auth';

const KEY = 'scanplay-wallet';

export const STREAK_RESTORE_WINDOW_MS = 48 * 60 * 60 * 1000;
export const XP_BOOST_DURATION_MS = 15 * 60 * 1000;
export const STARTING_COINS = 100;
export const MAX_AD_REWARDS_PER_DAY = 5;
export const AD_REWARD_COINS = 25;

export interface WalletState {
  coins: number;
  gems: number;
  xpBoostUntil: number | null;
  lastDailyChest: string | null;
  lastAdRewardDate: string | null;
  adWatchesToday: number;
  lostStreak: number;
  lostStreakAt: number | null;
  /** Dismissed streak-lost modal for the current loss (synced across devices). */
  lostStreakAckAt: number | null;
  /** Scans bonus achetés aujourd'hui (plan Free). */
  extraScansDate: string | null;
  extraScansBought: number;
  /** Crédits synthèse IA bonus (consommés après le quota mensuel). */
  synthesisBonusCredits: number;
  /** Protège la série une fois si un jour est manqué. */
  streakFreezeCharges: number;
}

const DEFAULT: WalletState = {
  coins: STARTING_COINS,
  gems: 0,
  xpBoostUntil: null,
  lastDailyChest: null,
  lastAdRewardDate: null,
  adWatchesToday: 0,
  lostStreak: 0,
  lostStreakAt: null,
  lostStreakAckAt: null,
  extraScansDate: null,
  extraScansBought: 0,
  synthesisBonusCredits: 0,
  streakFreezeCharges: 0,
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadWalletRaw(): WalletState {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!data || typeof data !== 'object') return { ...DEFAULT };
    return {
      coins: Number(data.coins ?? STARTING_COINS),
      gems: Number(data.gems ?? 0),
      xpBoostUntil: data.xpBoostUntil != null ? Number(data.xpBoostUntil) : null,
      lastDailyChest: data.lastDailyChest ?? null,
      lastAdRewardDate: data.lastAdRewardDate ?? null,
      adWatchesToday: Number(data.adWatchesToday ?? 0),
      lostStreak: Number(data.lostStreak ?? 0),
      lostStreakAt: data.lostStreakAt != null ? Number(data.lostStreakAt) : null,
      lostStreakAckAt: data.lostStreakAckAt != null ? Number(data.lostStreakAckAt) : null,
      extraScansDate: data.extraScansDate ?? null,
      extraScansBought: Number(data.extraScansBought ?? 0),
      synthesisBonusCredits: Number(data.synthesisBonusCredits ?? 0),
      streakFreezeCharges: Number(data.streakFreezeCharges ?? 0),
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveWalletRaw(state: WalletState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
  if (isLoggedIn()) {
    void import('./sync').then((m) => m.scheduleSync());
  }
}

export function getCoins(): number {
  return loadWalletRaw().coins;
}

export function getGems(): number {
  return loadWalletRaw().gems;
}

export function addGems(amount: number): void {
  if (amount <= 0) return;
  const w = loadWalletRaw();
  w.gems += amount;
  saveWalletRaw(w);
}

export function getXpBoostMultiplier(): number {
  const { xpBoostUntil } = loadWalletRaw();
  if (xpBoostUntil && Date.now() < xpBoostUntil) return 2;
  return 1;
}

export function isXpBoostActive(): boolean {
  return getXpBoostMultiplier() > 1;
}

export function getXpBoostMinutesLeft(): number {
  const { xpBoostUntil } = loadWalletRaw();
  if (!xpBoostUntil || Date.now() >= xpBoostUntil) return 0;
  return Math.ceil((xpBoostUntil - Date.now()) / 60000);
}

export function recordStreakLoss(previousStreak: number): void {
  if (previousStreak <= 0) return;
  const w = loadWalletRaw();
  if (w.lostStreak > 0 && w.lostStreakAt) return;
  w.lostStreak = previousStreak;
  w.lostStreakAt = Date.now();
  w.lostStreakAckAt = null;
  saveWalletRaw(w);
}

export function acknowledgeStreakLoss(): void {
  const w = loadWalletRaw();
  if (w.lostStreak <= 0 || !w.lostStreakAt) return;
  w.lostStreakAckAt = Date.now();
  saveWalletRaw(w);
  if (isLoggedIn()) {
    void import('./sync').then((m) => void m.pushUserData());
  }
}

export function shouldShowStreakLostModal(): boolean {
  const w = loadWalletRaw();
  if (w.lostStreak <= 0 || !w.lostStreakAt) return false;
  if (!w.lostStreakAckAt) return true;
  return w.lostStreakAckAt < w.lostStreakAt;
}

export function mergeStreakLossFromCloud(
  lostValue: number,
  lostAt: number | null | undefined,
  ackAt: number | null | undefined,
): void {
  const w = loadWalletRaw();
  let changed = false;
  const cloudLostAt = lostAt != null && lostAt > 0 ? Number(lostAt) : null;
  const cloudAckAt = ackAt != null && ackAt > 0 ? Number(ackAt) : null;
  const cloudLostValue = lostValue > 0 ? lostValue : 0;

  if (cloudLostAt && (!w.lostStreakAt || cloudLostAt >= w.lostStreakAt)) {
    w.lostStreakAt = cloudLostAt;
    if (cloudLostValue > 0) w.lostStreak = Math.max(w.lostStreak, cloudLostValue);
    changed = true;
  }

  if (cloudAckAt) {
    w.lostStreakAckAt = Math.max(w.lostStreakAckAt ?? 0, cloudAckAt);
    changed = true;
  }

  if (changed) {
    localStorage.setItem(KEY, JSON.stringify(w));
  }
}

export function canRestoreStreak(): boolean {
  const w = loadWalletRaw();
  if (w.lostStreak <= 0 || !w.lostStreakAt) return false;
  return Date.now() - w.lostStreakAt <= STREAK_RESTORE_WINDOW_MS;
}

export function getRestorableStreak(): number {
  return canRestoreStreak() ? loadWalletRaw().lostStreak : 0;
}

export function streakRestorePrice(streak: number): number {
  if (streak <= 0) return 0;
  return Math.round(15 + streak * 10 + streak ** 1.35);
}

export function streakRestoreHoursLeft(): number {
  const w = loadWalletRaw();
  if (!w.lostStreakAt) return 0;
  const left = STREAK_RESTORE_WINDOW_MS - (Date.now() - w.lostStreakAt);
  return Math.max(0, Math.ceil(left / 3600000));
}

export function addCoins(amount: number): void {
  const w = loadWalletRaw();
  w.coins = Math.max(0, w.coins + amount);
  saveWalletRaw(w);
}

/** Met à jour le solde local si le cloud a plus de ScanCoins (ex. transfert reçu). */
export function applyIncomingCoins(serverCoins: number): boolean {
  if (!Number.isFinite(serverCoins) || serverCoins < 0) return false;
  const w = loadWalletRaw();
  if (serverCoins <= w.coins) return false;
  w.coins = serverCoins;
  saveWalletRaw(w);
  return true;
}

export type SpendResult = { ok: true } | { ok: false; reason: 'insufficient' | 'not_logged_in' };

export function spendCoins(amount: number): SpendResult {
  const w = loadWalletRaw();
  if (w.coins < amount) return { ok: false, reason: 'insufficient' };
  w.coins -= amount;
  saveWalletRaw(w);
  return { ok: true };
}

export const MAX_EXTRA_SCANS_PER_DAY = 2;
export const EXTRA_SCAN_PRICE = 70;

function normalizeExtraScansDay(w: WalletState): WalletState {
  const today = todayKey();
  if (w.extraScansDate !== today) {
    w.extraScansDate = today;
    w.extraScansBought = 0;
  }
  return w;
}

export function getExtraScansBoughtToday(): number {
  const w = normalizeExtraScansDay({ ...loadWalletRaw() });
  return w.extraScansBought;
}

export function getExtraScanAllowance(): number {
  return getExtraScansBoughtToday();
}

export function canBuyExtraScan(): boolean {
  return getExtraScansBoughtToday() < MAX_EXTRA_SCANS_PER_DAY;
}

export function purchaseExtraScan(): SpendResult {
  if (!canBuyExtraScan()) return { ok: false, reason: 'insufficient' };
  const spent = spendCoins(EXTRA_SCAN_PRICE);
  if (!spent.ok) return spent;
  const w = normalizeExtraScansDay(loadWalletRaw());
  w.extraScansBought += 1;
  saveWalletRaw(w);
  return { ok: true };
}

export function getSynthesisBonusCredits(): number {
  return loadWalletRaw().synthesisBonusCredits;
}

export function grantSynthesisBonusCredit(): void {
  const w = loadWalletRaw();
  w.synthesisBonusCredits += 1;
  saveWalletRaw(w);
}

export function consumeSynthesisBonusCredit(): boolean {
  const w = loadWalletRaw();
  if (w.synthesisBonusCredits <= 0) return false;
  w.synthesisBonusCredits -= 1;
  saveWalletRaw(w);
  return true;
}

export function getStreakFreezeCharges(): number {
  return loadWalletRaw().streakFreezeCharges;
}

export function grantStreakFreezeCharge(): void {
  const w = loadWalletRaw();
  w.streakFreezeCharges = Math.min(3, w.streakFreezeCharges + 1);
  saveWalletRaw(w);
}

export function consumeStreakFreezeCharge(): boolean {
  const w = loadWalletRaw();
  if (w.streakFreezeCharges <= 0) return false;
  w.streakFreezeCharges -= 1;
  saveWalletRaw(w);
  return true;
}

export function activateXpBoost(durationMs = XP_BOOST_DURATION_MS): void {
  const w = loadWalletRaw();
  const now = Date.now();
  const base = w.xpBoostUntil && w.xpBoostUntil > now ? w.xpBoostUntil : now;
  w.xpBoostUntil = base + durationMs;
  saveWalletRaw(w);
}

export function restoreLostStreak(): SpendResult {
  const streak = getRestorableStreak();
  if (streak <= 0) return { ok: false, reason: 'insufficient' };
  const price = streakRestorePrice(streak);
  const spent = spendCoins(price);
  if (!spent.ok) return spent;

  const w = loadWalletRaw();
  void import('./gamification').then((g) => {
    g.restoreStreakValue(w.lostStreak);
  });

  w.lostStreak = 0;
  w.lostStreakAt = null;
  saveWalletRaw(w);
  return { ok: true };
}

export function clearStreakRestoreOffer(): void {
  const w = loadWalletRaw();
  w.lostStreak = 0;
  w.lostStreakAt = null;
  saveWalletRaw(w);
}

export function canClaimDailyChest(): boolean {
  return loadWalletRaw().lastDailyChest !== todayKey();
}

export function markDailyChestClaimed(): void {
  const w = loadWalletRaw();
  w.lastDailyChest = todayKey();
  saveWalletRaw(w);
}

export function canWatchAdForCoins(): boolean {
  const w = loadWalletRaw();
  const today = todayKey();
  if (w.lastAdRewardDate !== today) return true;
  return w.adWatchesToday < MAX_AD_REWARDS_PER_DAY;
}

export function recordAdReward(): void {
  const w = loadWalletRaw();
  const today = todayKey();
  if (w.lastAdRewardDate !== today) {
    w.lastAdRewardDate = today;
    w.adWatchesToday = 0;
  }
  w.adWatchesToday += 1;
  w.coins += AD_REWARD_COINS;
  saveWalletRaw(w);
}

export function getAdWatchesLeftToday(): number {
  const w = loadWalletRaw();
  const today = todayKey();
  if (w.lastAdRewardDate !== today) return MAX_AD_REWARDS_PER_DAY;
  return Math.max(0, MAX_AD_REWARDS_PER_DAY - w.adWatchesToday);
}
