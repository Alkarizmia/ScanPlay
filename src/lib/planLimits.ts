import type { BillingCycle, Locale, Plan, UpgradeReason } from '../types';
import { isLoggedIn } from './auth';
import { isLikelyImageFile } from './droppedFiles';
import { canGuestScan } from './guestTrial';
import { canSpendAiBudget } from './planUsage';
import { getExtraScanAllowance } from './wallet';

const PLAN_KEY = 'scanplay-plan';
const BILLING_KEY = 'scanplay-billing';
const PLAN_OWNER_KEY = 'scanplay-plan-user';
const SCANS_KEY = 'scanplay-scans-day';
export const PLAN_CHANGED_EVENT = 'scanplay-plan-changed';

let sessionUserId: string | null = null;

/** Tie cached plan to the signed-in Supabase user (avoids leaking plan across accounts). */
export function setPlanUserId(userId: string | null): void {
  if (userId && sessionUserId && userId !== sessionUserId) {
    clearPlanState();
  }
  sessionUserId = userId;
  if (!userId) return;
  const owner = localStorage.getItem(PLAN_OWNER_KEY);
  if (owner && owner !== userId) {
    clearPlanState();
  }
}

export function clearPlanState(): void {
  localStorage.removeItem(PLAN_KEY);
  localStorage.removeItem(BILLING_KEY);
  localStorage.removeItem(PLAN_OWNER_KEY);
  void import('./subscription').then((m) => m.clearSubscriptionMeta());
  notifyPlanChanged();
}

function notifyPlanChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PLAN_CHANGED_EVENT, { detail: getPlan() }));
}

export const PLAN_PRICES = {
  plus: { monthly: 4.99, annual: 49 },
  pro: { monthly: 9.99, annual: 99 },
  max: { monthly: 14.99, annual: 149 },
} as const;

/**
 * Soft technical ceilings only — subscription hard caps (scans/day, synth, coach, chars)
 * are removed. The real AI ceiling is the token envelope in planUsage (100% block, 90% saver).
 * maxWords is a shared OCR safety cap, identical for every plan.
 */
export const SCAN_SOFT_MAX_WORDS = 500;
export const CHAT_SOFT_MAX_CHARS = 4000;

export const PLAN_LIMITS = {
  free: {
    scansPerDay: Infinity,
    maxWords: SCAN_SOFT_MAX_WORDS,
    historyMax: 7,
    historyReplay: 2,
    pathSteps: 10,
    synthesesPerMonth: Infinity,
    chatPerDay: Infinity,
    chatMaxChars: CHAT_SOFT_MAX_CHARS,
    chatHistoryWindow: 7,
    universeHearts: 3,
  },
  plus: {
    scansPerDay: Infinity,
    maxWords: SCAN_SOFT_MAX_WORDS,
    historyMax: Infinity,
    historyReplay: 4,
    pathSteps: 20,
    synthesesPerMonth: Infinity,
    chatPerDay: Infinity,
    chatMaxChars: CHAT_SOFT_MAX_CHARS,
    chatHistoryWindow: 15,
    universeHearts: 5,
  },
  pro: {
    scansPerDay: Infinity,
    maxWords: SCAN_SOFT_MAX_WORDS,
    historyMax: Infinity,
    historyReplay: 7,
    pathSteps: 30,
    synthesesPerMonth: Infinity,
    chatPerDay: Infinity,
    chatMaxChars: CHAT_SOFT_MAX_CHARS,
    chatHistoryWindow: 25,
    universeHearts: Infinity,
  },
  max: {
    scansPerDay: Infinity,
    maxWords: SCAN_SOFT_MAX_WORDS,
    historyMax: Infinity,
    historyReplay: 12,
    pathSteps: 40,
    synthesesPerMonth: Infinity,
    chatPerDay: Infinity,
    chatMaxChars: CHAT_SOFT_MAX_CHARS,
    chatHistoryWindow: 40,
    universeHearts: Infinity,
  },
} as const;

export const DEFAULT_PATH_STEP_COUNT = PLAN_LIMITS.free.pathSteps;

function readStoredPlan(): Plan {
  const stored = localStorage.getItem(PLAN_KEY);
  if (stored === 'plus' || stored === 'pro' || stored === 'max' || stored === 'free') return stored;
  return 'free';
}

function planBelongsToSession(): boolean {
  const stored = readStoredPlan();
  if (stored === 'free') return true;
  const owner = localStorage.getItem(PLAN_OWNER_KEY);
  if (!owner) return false;
  if (sessionUserId) return owner === sessionUserId;
  return true;
}

export function getPlan(): Plan {
  if (!planBelongsToSession()) return 'free';
  return readStoredPlan();
}

export function isPaidPlan(plan: Plan): boolean {
  return plan === 'plus' || plan === 'pro' || plan === 'max';
}

export function setPlan(plan: Plan): void {
  localStorage.setItem(PLAN_KEY, plan);
  if (sessionUserId) {
    localStorage.setItem(PLAN_OWNER_KEY, sessionUserId);
  }
  notifyPlanChanged();
  void import('./sync').then((m) => m.scheduleSync());
}

export function getBillingCycle(): BillingCycle {
  const stored = localStorage.getItem(BILLING_KEY);
  if (stored === 'monthly' || stored === 'annual') return stored;
  return 'monthly';
}

export function setBillingCycle(cycle: BillingCycle): void {
  localStorage.setItem(BILLING_KEY, cycle);
  void import('./sync').then((m) => m.scheduleSync());
}

export function formatPrice(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function incrementScansToday(): void {
  const data = JSON.parse(localStorage.getItem(SCANS_KEY) ?? '{}') as Record<string, number>;
  const key = todayKey();
  data[key] = (data[key] ?? 0) + 1;
  localStorage.setItem(SCANS_KEY, JSON.stringify(data));
  void import('./sync').then((m) => m.scheduleSync());
}

export function getDailyScanLimit(plan?: Plan): number {
  return PLAN_LIMITS[plan ?? getPlan()].scansPerDay;
}

export function getDailyChatLimit(plan?: Plan): number {
  return PLAN_LIMITS[plan ?? getPlan()].chatPerDay;
}

export function getChatMaxChars(plan?: Plan): number {
  return PLAN_LIMITS[plan ?? getPlan()].chatMaxChars;
}

export function getChatHistoryWindow(plan?: Plan): number {
  return PLAN_LIMITS[plan ?? getPlan()].chatHistoryWindow;
}

export function getScansRemaining(): number | typeof Infinity {
  if (!isLoggedIn()) {
    return canGuestScan() ? 1 : 0;
  }
  // Daily scan caps removed — AI envelope is the only ceiling.
  void getExtraScanAllowance;
  return canSpendAiBudget() ? Infinity : 0;
}

/** @deprecated Daily scan quotas removed; kept for older UI call sites. */
export function formatScansQuota(): string {
  if (!isLoggedIn()) {
    return canGuestScan() ? '0/1' : '1/1';
  }
  return '∞';
}

export function canScan(): boolean {
  if (!isLoggedIn()) {
    return canGuestScan();
  }
  return canSpendAiBudget();
}

export function recordScan(): void {
  incrementScansToday();
}

/** Max images per import batch (guest = 1 photo, otherwise remaining daily scans). */
export function getMaxImagesPerImport(): number {
  if (!isLoggedIn()) {
    return canGuestScan() ? 1 : 0;
  }
  const remaining = getScansRemaining();
  if (remaining === Infinity) return 20;
  return Math.max(0, remaining);
}

export function clampImagesForImport(files: File[]): { files: File[]; dropped: number } {
  const images = files.filter(isLikelyImageFile);
  const max = getMaxImagesPerImport();
  if (images.length <= max) return { files: images, dropped: 0 };
  return { files: images.slice(0, max), dropped: images.length - max };
}

export function truncatePairs<T>(pairs: T[]): T[] {
  return pairs.slice(0, SCAN_SOFT_MAX_WORDS);
}

export function getMaxWords(): number {
  return SCAN_SOFT_MAX_WORDS;
}

export function getHistoryMax(): number {
  const max = PLAN_LIMITS[getPlan()].historyMax;
  return max === Infinity ? 9999 : max;
}

export function getPathStepCount(plan?: Plan): number {
  const p = plan ?? getPlan();
  return PLAN_LIMITS[p].pathSteps;
}

export function hasFeature(
  feature: 'spaced' | 'export' | 'synthesis' | 'exam' | 'share' | 'stats' | 'multiplayer',
  plan?: Plan,
): boolean {
  const p = plan ?? getPlan();
  if (feature === 'synthesis') return true;
  if (feature === 'share' || feature === 'exam') return p === 'pro' || p === 'max';
  if (feature === 'spaced' || feature === 'export' || feature === 'stats' || feature === 'multiplayer') {
    return p !== 'free';
  }
  return false;
}

export function getUniverseHeartCap(plan?: Plan): number {
  return PLAN_LIMITS[plan ?? getPlan()].universeHearts;
}

export function getUpgradeReasonForScan(): UpgradeReason | null {
  if (!isLoggedIn()) {
    return canGuestScan() ? null : 'scans';
  }
  if (!canScan()) return 'aiBudget';
  return null;
}

/** @deprecated Hard scan/word multipliers removed — AI envelope is the differentiator. */
export function planGapVsFree(_plan: Plan): { scanFactor: number; wordFactor: number } | null {
  return null;
}

export function formatGapFactor(n: number, locale: Locale): string {
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 10) / 10;
  const sep = locale === 'en' ? '.' : ',';
  return String(rounded).replace('.', sep);
}

export function planLabel(plan: Plan): string {
  const labels: Record<Plan, string> = { free: 'ScanPlay', plus: 'Plus', pro: 'Pro', max: 'Max' };
  return labels[plan];
}

export function planPrice(plan: Plan, cycle: BillingCycle = getBillingCycle()): string {
  if (plan === 'free') return '0 €';
  const prices = PLAN_PRICES[plan];
  return formatPrice(cycle === 'annual' ? prices.annual : prices.monthly);
}

export function planMonthlyEquivalent(plan: Plan): string | null {
  if (plan === 'free') return null;
  return formatPrice(PLAN_PRICES[plan].annual / 12);
}

export function planAnnualSavingsPercent(plan: Plan): number {
  if (plan === 'free') return 0;
  const { monthly, annual } = PLAN_PRICES[plan];
  return Math.round((1 - annual / (monthly * 12)) * 100);
}
