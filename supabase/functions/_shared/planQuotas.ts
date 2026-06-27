export type Plan = 'free' | 'plus' | 'pro';

export const PLAN_LIMITS = {
  free: { scansPerDay: 3, synthesesPerMonth: 2 },
  plus: { scansPerDay: Number.POSITIVE_INFINITY, synthesesPerMonth: 15 },
  pro: { scansPerDay: Number.POSITIVE_INFINITY, synthesesPerMonth: 40 },
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

export async function fetchUserPlan(supabase: DbClient, userId: string): Promise<Plan> {
  const { data } = await supabase
    .from('scanplay_profiles')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle();
  const plan = data?.plan;
  if (plan === 'plus' || plan === 'pro') return plan;
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

export function assertCanScan(plan: Plan, statsData: Record<string, unknown>): string | null {
  const limit = PLAN_LIMITS[plan].scansPerDay;
  if (!Number.isFinite(limit)) return null;
  if (getScansTodayFromStats(statsData) >= limit) return 'scan_quota_exceeded';
  return null;
}

export function assertCanSynthesize(plan: Plan, statsData: Record<string, unknown>): string | null {
  const limit = PLAN_LIMITS[plan].synthesesPerMonth;
  if (getSynthesisUsedFromStats(statsData) >= limit) return 'synthesis_quota_exceeded';
  return null;
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
  await supabase.from('scanplay_user_stats').upsert(
    {
      user_id: userId,
      data: { ...data, synthesisMonth: { month, used } },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
}
