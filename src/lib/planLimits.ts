import type { BillingCycle, Plan, UpgradeReason } from '../types';
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
  plus: { monthly: 4.99, annual: 49.99 },
  pro: { monthly: 9.99, annual: 99.99 },
} as const;

export const PLAN_LIMITS = {
  free: { scansPerDay: 3, maxWords: 15, historyMax: 7, pathSteps: 10, synthesesPerMonth: 2 },
  plus: { scansPerDay: Infinity, maxWords: 50, historyMax: Infinity, pathSteps: 15, synthesesPerMonth: 15 },
  pro: { scansPerDay: Infinity, maxWords: 100, historyMax: Infinity, pathSteps: 20, synthesesPerMonth: 40 },
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

export function getScansRemaining(): number | typeof Infinity {
  const plan = getPlan();
  const limit = PLAN_LIMITS[plan].scansPerDay;
  if (limit === Infinity) return Infinity;
  const extra = getExtraScanAllowance();
  return Math.max(0, limit + extra - getScansToday());
}

/** Label for scan quota in UI (∞ for Plus/Pro). */
export function formatScansQuota(): string {
  const plan = getPlan();
  if (PLAN_LIMITS[plan].scansPerDay === Infinity) return '∞';
  const left = getScansRemaining();
  if (left === Infinity) return '∞';
  const limit = PLAN_LIMITS.free.scansPerDay;
  const used = Math.max(0, limit - left);
  return `${used}/${limit}`;
}

export function canScan(): boolean {
  const plan = getPlan();
  const limit = PLAN_LIMITS[plan].scansPerDay;
  if (limit === Infinity) return true;
  return getScansToday() < limit + getExtraScanAllowance();
}

export function recordScan(): void {
  const plan = getPlan();
  if (PLAN_LIMITS[plan].scansPerDay !== Infinity) {
    incrementScansToday();
  }
}

/** Max images per import batch (Free = remaining daily scans, paid = generous cap). */
export function getMaxImagesPerImport(): number {
  const plan = getPlan();
  if (PLAN_LIMITS[plan].scansPerDay === Infinity) return 20;
  const remaining = getScansRemaining();
  if (remaining === Infinity) return 20;
  return Math.max(0, remaining);
}

export function clampImagesForImport(files: File[]): { files: File[]; dropped: number } {
  const images = files.filter((f) => f.type.startsWith('image/'));
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
  if (feature === 'synthesis') return true;
  if (feature === 'share' || feature === 'exam') return p === 'pro';
  if (feature === 'spaced' || feature === 'export' || feature === 'stats' || feature === 'multiplayer') {
    return p !== 'free';
  }
  return false;
}

export function getUpgradeReasonForScan(): UpgradeReason | null {
  if (!canScan()) return 'scans';
  return null;
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
