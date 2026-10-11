export type Plan = 'free' | 'plus' | 'pro' | 'max';

/** Soft OCR safety cap — same for every plan (no subscription word ceiling). */
export const SCAN_SOFT_MAX_WORDS = 500;
export const CHAT_SOFT_MAX_CHARS = 4000;

export const TOKEN_SHARE = 0.65;
export const FREE_WEEKLY_TOKEN_EUR = 0.15;
export const SCAN_TOKEN_EUR = 0.05;
export const COACH_TOKEN_EUR = 0.01;
export const SYNTHESIS_TOKEN_EUR = 0.08;
export const AI_SAVER_THRESHOLD = 0.9;

const PLAN_MONTHLY_EUR: Record<Exclude<Plan, 'free'>, number> = {
  plus: 4.99,
  pro: 9.99,
  max: 14.99,
};

export const PLAN_LIMITS = {
  free: {
    scansPerDay: Number.POSITIVE_INFINITY,
    synthesesPerMonth: Number.POSITIVE_INFINITY,
    maxWords: SCAN_SOFT_MAX_WORDS,
    chatPerDay: Number.POSITIVE_INFINITY,
    chatMaxChars: CHAT_SOFT_MAX_CHARS,
    chatHistoryWindow: 7,
  },
  plus: {
    scansPerDay: Number.POSITIVE_INFINITY,
    synthesesPerMonth: Number.POSITIVE_INFINITY,
    maxWords: SCAN_SOFT_MAX_WORDS,
    chatPerDay: Number.POSITIVE_INFINITY,
    chatMaxChars: CHAT_SOFT_MAX_CHARS,
    chatHistoryWindow: 15,
  },
  pro: {
    scansPerDay: Number.POSITIVE_INFINITY,
    synthesesPerMonth: Number.POSITIVE_INFINITY,
    maxWords: SCAN_SOFT_MAX_WORDS,
    chatPerDay: Number.POSITIVE_INFINITY,
    chatMaxChars: CHAT_SOFT_MAX_CHARS,
    chatHistoryWindow: 25,
  },
  max: {
    scansPerDay: Number.POSITIVE_INFINITY,
    synthesesPerMonth: Number.POSITIVE_INFINITY,
    maxWords: SCAN_SOFT_MAX_WORDS,
    chatPerDay: Number.POSITIVE_INFINITY,
    chatMaxChars: CHAT_SOFT_MAX_CHARS,
    chatHistoryWindow: 40,
  },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = { from: (table: string) => any };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function weekStartKey(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() - day + 1);
  return x.toISOString().slice(0, 10);
}

export function planTokenEnvelopeEur(plan: Plan): number {
  if (plan === 'free') return FREE_WEEKLY_TOKEN_EUR;
  return Math.round(PLAN_MONTHLY_EUR[plan] * TOKEN_SHARE * 100) / 100;
}

function sumInPeriod(map: Record<string, number> | undefined, plan: Plan): number {
  const safe = map && typeof map === 'object' ? map : {};
  if (plan === 'free') {
    const start = weekStartKey();
    return Object.entries(safe).reduce((acc, [day, n]) => (day >= start ? acc + (Number(n) || 0) : acc), 0);
  }
  const prefix = monthKey();
  return Object.entries(safe).reduce(
    (acc, [day, n]) => (day.startsWith(prefix) ? acc + (Number(n) || 0) : acc),
    0,
  );
}

export function getTokenUsedEurFromStats(plan: Plan, data: Record<string, unknown>): number {
  const scans = sumInPeriod(data.scansDay as Record<string, number> | undefined, plan);
  const coach = sumInPeriod(data.coachDay as Record<string, number> | undefined, plan);
  const synth = sumInPeriod(data.synthesisTokenDay as Record<string, number> | undefined, plan);
  // Fallback: monthly synthesis counter if day-map not synced yet.
  const synthMonth = getSynthesisUsedFromStats(data);
  const synthCount = synth > 0 ? synth : synthMonth;
  return Math.round((scans * SCAN_TOKEN_EUR + coach * COACH_TOKEN_EUR + synthCount * SYNTHESIS_TOKEN_EUR) * 100) / 100;
}

export function getAiUsageRatioFromStats(plan: Plan, data: Record<string, unknown>): number {
  const budget = planTokenEnvelopeEur(plan);
  if (budget <= 0) return 1;
  return Math.min(1, getTokenUsedEurFromStats(plan, data) / budget);
}

export function isAiSaverFromStats(plan: Plan, data: Record<string, unknown>): boolean {
  const ratio = getAiUsageRatioFromStats(plan, data);
  return ratio >= AI_SAVER_THRESHOLD && ratio < 1;
}

export async function fetchUserPlan(supabase: DbClient, userId: string): Promise<Plan> {
  const { data } = await supabase
    .from('scanplay_profiles')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle();
  const plan = data?.plan;
  if (plan === 'plus' || plan === 'pro' || plan === 'max') return plan;
  return 'free';
}

export async function fetchUserStatsData(
  supabase: DbClient,
  userId: string,
): Promise<Record<string, unknown>> {
  const { data } = await supabase
    .from('scanplay_user_stats')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.data as Record<string, unknown> | undefined) ?? {};
}

export function getScansTodayFromStats(data: Record<string, unknown>): number {
  const scansDay = (data.scansDay as Record<string, number> | undefined) ?? {};
  return scansDay[todayKey()] ?? 0;
}

export function getSynthesisUsedFromStats(data: Record<string, unknown>): number {
  const usage = data.synthesisMonth as { month?: string; used?: number } | undefined;
  if (!usage || usage.month !== monthKey()) return 0;
  return Math.max(0, Number(usage.used ?? 0));
}

/** Sole hard ceiling: AI token envelope at 100%. */
export function assertCanUseAiBudget(plan: Plan, statsData: Record<string, unknown>): string | null {
  if (getAiUsageRatioFromStats(plan, statsData) >= 1) return 'ai_budget_exhausted';
  return null;
}

export function assertCanScan(plan: Plan, statsData: Record<string, unknown>): string | null {
  return assertCanUseAiBudget(plan, statsData);
}

export function assertCanSynthesize(plan: Plan, statsData: Record<string, unknown>): string | null {
  return assertCanUseAiBudget(plan, statsData);
}

export async function incrementScanCount(supabase: DbClient, userId: string): Promise<void> {
  const data = await fetchUserStatsData(supabase, userId);
  const key = todayKey();
  const scansDay = { ...((data.scansDay as Record<string, number>) ?? {}) };
  scansDay[key] = (scansDay[key] ?? 0) + 1;
  await supabase.from('scanplay_user_stats').upsert(
    {
      user_id: userId,
      data: { ...data, scansDay },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
}

export async function incrementSynthesisCount(supabase: DbClient, userId: string): Promise<void> {
  const data = await fetchUserStatsData(supabase, userId);
  const month = monthKey();
  const prev = data.synthesisMonth as { month?: string; used?: number } | undefined;
  const used = prev?.month === month ? (prev.used ?? 0) + 1 : 1;
  const dayKey = todayKey();
  const synthesisTokenDay = { ...((data.synthesisTokenDay as Record<string, number>) ?? {}) };
  synthesisTokenDay[dayKey] = (synthesisTokenDay[dayKey] ?? 0) + 1;
  await supabase.from('scanplay_user_stats').upsert(
    {
      user_id: userId,
      data: { ...data, synthesisMonth: { month, used }, synthesisTokenDay },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
}
