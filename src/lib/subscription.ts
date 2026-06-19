import type { Plan } from '../types';

const PERIOD_END_KEY = 'scanplay-sub-period-end';
const CANCEL_AT_END_KEY = 'scanplay-sub-cancel-at-end';

export function getSubscriptionPeriodEnd(): Date | null {
  const raw = localStorage.getItem(PERIOD_END_KEY);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getSubscriptionCancelAtPeriodEnd(): boolean {
  return localStorage.getItem(CANCEL_AT_END_KEY) === '1';
}

export function applySubscriptionMeta(
  periodEnd: string | null | undefined,
  cancelAtPeriodEnd: boolean | null | undefined,
): void {
  if (periodEnd) {
    localStorage.setItem(PERIOD_END_KEY, periodEnd);
  } else {
    localStorage.removeItem(PERIOD_END_KEY);
  }
  localStorage.setItem(CANCEL_AT_END_KEY, cancelAtPeriodEnd ? '1' : '0');
}

export function clearSubscriptionMeta(): void {
  localStorage.removeItem(PERIOD_END_KEY);
  localStorage.removeItem(CANCEL_AT_END_KEY);
}

export function hasActivePaidSubscription(): boolean {
  const end = getSubscriptionPeriodEnd();
  if (!end) return false;
  return end.getTime() > Date.now();
}


export function canCheckoutPlan(currentPlan: Plan, targetPlan: Plan): boolean {
  if (targetPlan === 'free') return true;
  if (currentPlan === targetPlan) return false;
  if (!hasActivePaidSubscription()) return true;
  return false;
}

export function formatSubscriptionDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
