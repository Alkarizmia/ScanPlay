import type { SupabaseClient } from '@supabase/supabase-js';

/** Resend Free plan caps. */
export const RESEND_DAILY_CAP = 100;
export const RESEND_MONTHLY_CAP = 3000;
export const MONTHLY_WARN_RATIO = 0.8;
export const MONTHLY_CRIT_RATIO = 0.9;
/** P2/P3: abandon after this many consecutive quota deferrals. */
export const MAX_DEFER_DAYS = 5;

export function parisYmd(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function addCalendarDays(ymd: string, delta: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

export function parisMonthPrefix(ymd = parisYmd()): string {
  return ymd.slice(0, 7);
}

/** Start/end ISO bounds for a Paris calendar day (approx via UTC+1/+2 window). */
export function parisDayUtcBounds(ymd: string): { start: string; end: string } {
  // Europe/Paris offset: use noon UTC of that calendar date ± 14h to cover CET/CEST safely
  // Better: construct with explicit offset via Intl — use Date from YMD as UTC midnight then expand.
  const start = new Date(`${ymd}T00:00:00+01:00`);
  const end = new Date(start.getTime() + 26 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export type QuotaSnapshot = {
  today: string;
  month: string;
  sent_today: number;
  sent_month: number;
  remaining_today: number;
  remaining_month: number;
  daily_cap: number;
  monthly_cap: number;
  monthly_ratio: number;
  warn: boolean;
  critical: boolean;
};

export async function countSentEmails(
  admin: SupabaseClient,
  fromIso: string,
  toIso?: string,
): Promise<number> {
  let q = admin
    .from('scanplay_email_log')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', fromIso);
  if (toIso) q = q.lt('sent_at', toIso);
  const { count, error } = await q;
  if (error) {
    // Pre-migration fallback: no status column → count all rows
    let q2 = admin
      .from('scanplay_email_log')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', fromIso);
    if (toIso) q2 = q2.lt('sent_at', toIso);
    const fallback = await q2;
    if (fallback.error) {
      console.warn('email quota count', error.message, fallback.error.message);
      return 0;
    }
    return fallback.count ?? 0;
  }
  return count ?? 0;
}

export async function getQuotaSnapshot(admin: SupabaseClient): Promise<QuotaSnapshot> {
  const today = parisYmd();
  const month = parisMonthPrefix(today);
  const dayBounds = parisDayUtcBounds(today);
  const monthStart = `${month}-01T00:00:00+01:00`;

  const [sent_today, sent_month] = await Promise.all([
    countSentEmails(admin, dayBounds.start, dayBounds.end),
    countSentEmails(admin, new Date(monthStart).toISOString()),
  ]);

  const remaining_today = Math.max(0, RESEND_DAILY_CAP - sent_today);
  const remaining_month = Math.max(0, RESEND_MONTHLY_CAP - sent_month);
  const monthly_ratio = sent_month / RESEND_MONTHLY_CAP;

  return {
    today,
    month,
    sent_today,
    sent_month,
    remaining_today,
    remaining_month,
    daily_cap: RESEND_DAILY_CAP,
    monthly_cap: RESEND_MONTHLY_CAP,
    monthly_ratio,
    warn: monthly_ratio >= MONTHLY_WARN_RATIO,
    critical: monthly_ratio >= MONTHLY_CRIT_RATIO,
  };
}

export function remainingSendBudget(quota: QuotaSnapshot): number {
  return Math.min(quota.remaining_today, quota.remaining_month);
}
