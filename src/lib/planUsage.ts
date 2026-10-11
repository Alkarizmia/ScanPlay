import type { BillingCycle, Plan } from '../types';
import { PLAN_PRICES, getBillingCycle, getPlan, formatPrice } from './planLimits';

const SCANS_KEY = 'scanplay-scans-day';
const COACH_USAGE_KEY = 'scanplay-coach-day';
const SYNTHESIS_USAGE_KEY = 'scanplay-synthesis-token-day';

/** API cost share billed to the user envelope (65% of subscription). */
export const TOKEN_SHARE = 0.65;

/** Approximate euro cost per AI action (matches pricing strategy). */
export const SCAN_TOKEN_EUR = 0.05;
export const COACH_TOKEN_EUR = 0.01;
export const SYNTHESIS_TOKEN_EUR = 0.08;

/** At ≥90% of the AI envelope, step down model quality to save tokens. */
export const AI_SAVER_THRESHOLD = 0.9;

export type AiBudgetState = 'ok' | 'saver' | 'exhausted';

export type HeartTierLabel = '3' | '5regen' | 'infinite';

/** Visual heart tiers Free → Max (not soft daily caps). */
export const PLAN_HEART_TIER: Record<Plan, HeartTierLabel> = {
  free: '3',
  plus: '5regen',
  pro: 'infinite',
  max: 'infinite',
};

/** Paid price for the active billing cycle (monthly €, or annual ÷ 12). */
function planBillableMonthlyEur(plan: Exclude<Plan, 'free'>, cycle: BillingCycle): number {
  if (cycle === 'annual') return PLAN_PRICES[plan].annual / 12;
  return PLAN_PRICES[plan].monthly;
}

/** Token envelope in € — Free weekly, paid = 65% of what the user pays this cycle. */
export function planTokenEnvelopeEur(plan: Plan, cycle: BillingCycle = getBillingCycle()): number {
  if (plan === 'free') return 0.15;
  return Math.round(planBillableMonthlyEur(plan, cycle) * TOKEN_SHARE * 100) / 100;
}

export function planTokenEnvelopeLabel(plan: Plan, locale: string): string {
  const amount = formatPrice(planTokenEnvelopeEur(plan));
  if (plan === 'free') {
    return locale === 'en' ? `${amount}/wk` : `${amount}/sem`;
  }
  return locale === 'en' ? `${amount}/mo` : `${amount}/mois`;
}

function isoDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function weekStartKey(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() - day + 1);
  return x.toISOString().slice(0, 10);
}

function monthPrefix(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

function readDayMap(key: string): Record<string, number> {
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, number>;
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function sumInPeriod(map: Record<string, number>, plan: Plan): number {
  if (plan === 'free') {
    const start = weekStartKey();
    return Object.entries(map).reduce((acc, [day, n]) => (day >= start ? acc + (Number(n) || 0) : acc), 0);
  }
  const prefix = monthPrefix();
  return Object.entries(map).reduce(
    (acc, [day, n]) => (day.startsWith(prefix) ? acc + (Number(n) || 0) : acc),
    0,
  );
}

function bumpDayMap(storageKey: string, count = 1): void {
  const map = readDayMap(storageKey);
  const key = isoDay();
  map[key] = (map[key] ?? 0) + Math.max(1, count);
  localStorage.setItem(storageKey, JSON.stringify(map));
  void import('./sync').then((m) => m.scheduleSync());
}

export function recordCoachTokenUse(count = 1): void {
  bumpDayMap(COACH_USAGE_KEY, count);
}

export function recordSynthesisTokenUse(count = 1): void {
  bumpDayMap(SYNTHESIS_USAGE_KEY, count);
}

export function getTokenUsedEur(plan: Plan = getPlan()): number {
  const scans = sumInPeriod(readDayMap(SCANS_KEY), plan);
  const coach = sumInPeriod(readDayMap(COACH_USAGE_KEY), plan);
  const synth = sumInPeriod(readDayMap(SYNTHESIS_USAGE_KEY), plan);
  return Math.round((scans * SCAN_TOKEN_EUR + coach * COACH_TOKEN_EUR + synth * SYNTHESIS_TOKEN_EUR) * 100) / 100;
}

export function getAiUsageRatio(plan: Plan = getPlan()): number {
  const budget = planTokenEnvelopeEur(plan);
  if (budget <= 0) return 1;
  return Math.min(1, getTokenUsedEur(plan) / budget);
}

export function getAiBudgetState(plan: Plan = getPlan()): AiBudgetState {
  const ratio = getAiUsageRatio(plan);
  if (ratio >= 1) return 'exhausted';
  if (ratio >= AI_SAVER_THRESHOLD) return 'saver';
  return 'ok';
}

/** Soft quality step-down (cheaper models) once the AI bar hits ~90%. */
export function isAiSaverMode(plan: Plan = getPlan()): boolean {
  return getAiBudgetState(plan) === 'saver';
}

/** Hard stop when the AI envelope is fully used (100%). */
export function canSpendAiBudget(plan: Plan = getPlan()): boolean {
  return getAiBudgetState(plan) !== 'exhausted';
}

export interface PlanUsageLine {
  id: 'tokens' | 'hearts';
  usedRatio: number;
  percentUsed: number;
  usedLabel: string;
  budgetLabel: string;
}

export interface PlanUsageSnapshot {
  plan: Plan;
  period: 'week' | 'month';
  lines: PlanUsageLine[];
  tokenUsedEur: number;
  tokenBudgetEur: number;
}

export function getPlanUsageSnapshot(plan: Plan = getPlan()): PlanUsageSnapshot {
  const tokenUsedEur = getTokenUsedEur(plan);
  const tokenBudgetEur = planTokenEnvelopeEur(plan);
  const tokenRatio = tokenBudgetEur > 0 ? Math.min(1, tokenUsedEur / tokenBudgetEur) : 0;

  const tier = PLAN_HEART_TIER[plan];
  const heartsCap = tier === '3' ? 3 : tier === '5regen' ? 5 : Number.POSITIVE_INFINITY;
  let heartsLeft = heartsCap;
  try {
    const raw = localStorage.getItem('scanplay-universe-hearts');
    if (raw) {
      const parsed = JSON.parse(raw) as { hearts?: number };
      if (typeof parsed.hearts === 'number' && Number.isFinite(parsed.hearts)) {
        heartsLeft = Math.max(0, parsed.hearts);
      }
    }
  } catch {
    /* ignore */
  }

  const heartsInfinite = tier === 'infinite';
  const heartsUsed = heartsInfinite || !Number.isFinite(heartsCap) ? 0 : Math.max(0, heartsCap - heartsLeft);
  const heartsRatio = heartsInfinite || heartsCap <= 0 ? 0 : Math.min(1, heartsUsed / heartsCap);

  return {
    plan,
    period: plan === 'free' ? 'week' : 'month',
    tokenUsedEur,
    tokenBudgetEur,
    lines: [
      {
        id: 'tokens',
        usedRatio: tokenRatio,
        percentUsed: Math.round(tokenRatio * 100),
        usedLabel: formatPrice(tokenUsedEur),
        budgetLabel: formatPrice(tokenBudgetEur),
      },
      {
        id: 'hearts',
        usedRatio: heartsRatio,
        percentUsed: heartsInfinite ? 0 : Math.round(heartsRatio * 100),
        usedLabel: heartsInfinite ? '∞' : String(Math.min(heartsUsed, heartsCap as number)),
        budgetLabel: tier === 'infinite' ? '∞' : tier === '5regen' ? '5' : String(heartsCap),
      },
    ],
  };
}
