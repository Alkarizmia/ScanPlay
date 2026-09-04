import type { BillingCycle, Locale, Plan, UpgradeReason } from '../types';
import { isLoggedIn } from './auth';
import { isLikelyImageFile } from './droppedFiles';
import { canGuestScan } from './guestTrial';
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
  plus: { monthly: 12.99, annual: 129 },
  pro: { monthly: 19.99, annual: 199 },
} as const;

export const PLAN_LIMITS = {
  free: { scansPerDay: 2, maxWords: 25, historyMax: 7, pathSteps: 10, synthesesPerMonth: 2 },
  plus: { scansPerDay: 10, maxWords: 100, historyMax: Infinity, pathSteps: 20, synthesesPerMonth: 15 },
  pro: { scansPerDay: 15, maxWords: 250, historyMax: Infinity, pathSteps: 30, synthesesPerMonth: 40 },
} as const;

export const DEFAULT_PATH_STEP_COUNT = PLAN_LIMITS.free.pathSteps;

function readStoredPlan(): Plan {
  const stored = localStorage.getItem(PLAN_KEY);
  if (stored === 'plus' || stored === 'pro' || stored === 'free') return stored;
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

function getScansToday(): number {
  try {
    const data = JSON.parse(localStorage.getItem(SCANS_KEY) ?? '{}') as Record<string, number>;
    return data[todayKey()] ?? 0;
  } catch {
    return 0;
  }
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

export function getScansRemaining(): number | typeof Infinity {
  if (!isLoggedIn()) {
    return canGuestScan() ? 1 : 0;
  }
  const limit = getDailyScanLimit();
  const extra = getExtraScanAllowance();
  return Math.max(0, limit + extra - getScansToday());
}

/** Used / daily scan quota for the current plan. */
export function formatScansQuota(): string {
  if (!isLoggedIn()) {
    return canGuestScan() ? '0/1' : '1/1';
  }
  const limit = getDailyScanLimit();
  const used = Math.min(getScansToday(), limit);
  return `${used}/${limit}`;
}

export function canScan(): boolean {
  if (!isLoggedIn()) {
    return canGuestScan();
  }
  return getScansToday() < getDailyScanLimit() + getExtraScanAllowance();
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
  const max = PLAN_LIMITS[getPlan()].maxWords;
  return pairs.slice(0, max);
}

export function getMaxWords(): number {
  return PLAN_LIMITS[getPlan()].maxWords;
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
  if (feature === 'synthesis') return PLAN_LIMITS[p].synthesesPerMonth > 0;
  if (feature === 'share' || feature === 'exam') return p === 'pro';
  if (feature === 'spaced' || feature === 'export' || feature === 'stats' || feature === 'multiplayer') {
    return p !== 'free';
  }
  return false;
}

export function getUpgradeReasonForScan(): UpgradeReason | null {
  if (!isLoggedIn()) {
    return canGuestScan() ? null : 'scans';
  }
  if (!canScan()) return 'scans';
  return null;
}

/** How much Plus/Pro multiply Free quotas (shown on the pricing cards). */
export function planGapVsFree(plan: Plan): { scanFactor: number; wordFactor: number } | null {
  if (plan === 'free') return null;
  return {
    scanFactor: PLAN_LIMITS[plan].scansPerDay / PLAN_LIMITS.free.scansPerDay,
    wordFactor: PLAN_LIMITS[plan].maxWords / PLAN_LIMITS.free.maxWords,
  };
}

export function formatGapFactor(n: number, locale: Locale): string {
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 10) / 10;
  const sep = locale === 'en' ? '.' : ',';
  return String(rounded).replace('.', sep);
}

export function planLabel(plan: Plan): string {
  const labels: Record<Plan, string> = { free: 'ScanPlay', plus: 'Plus', pro: 'Pro' };
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
