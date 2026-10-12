import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { User } from '@supabase/supabase-js';
import { tryGetSupabaseAdmin } from '../server/auth.js';
import { getQuotaSnapshot } from '../server/emailQuota.js';

const THIN_DECK_THRESHOLD = 10;
/** Estimated € per successful scan (deck). Not real OpenAI billing. */
const SCAN_COST_EUR = 0.05;
const MS_DAY = 24 * 60 * 60 * 1000;

type ProfileRow = {
  user_id: string;
  plan: string;
  xp: number;
  streak: number;
  last_play_date: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  billing_cycle: string | null;
  subscription_period_end: string | null;
  subscription_cancel_at_period_end: boolean | null;
};

type DeckRow = {
  id: string;
  user_id: string;
  title: string;
  pairs: unknown;
  created_at: string;
};

type PublicProfileRow = {
  user_id: string;
  display_name: string;
};

type TestimonialRow = {
  id: string;
  created_at: string;
  author_name: string;
  role: string;
  rating: number;
  quote: string;
  email: string | null;
  locale: string | null;
  approved: boolean;
  source: string | null;
};

type AdminClient = NonNullable<ReturnType<typeof tryGetSupabaseAdmin>>;

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-admin-secret, authorization');
}

function adminOk(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = String(req.headers['x-admin-secret'] ?? '');
  const auth = req.headers.authorization ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const query = typeof req.query.secret === 'string' ? req.query.secret : '';
  return header === secret || bearer === secret || query === secret;
}

function pairCount(pairs: unknown): number {
  return Array.isArray(pairs) ? pairs.length : 0;
}

function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1);
}

function roundEur(n: number): number {
  return Math.round(n * 100) / 100;
}

function authProvider(user: User): string {
  const identities = user.identities ?? [];
  if (identities.length > 0) {
    const providers = [...new Set(identities.map((i) => i.provider).filter(Boolean))];
    if (providers.length) return providers.join('+');
  }
  const meta = user.app_metadata?.provider;
  if (typeof meta === 'string' && meta) return meta;
  return 'unknown';
}

function parisYmd(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addCalendarDays(ymd: string, delta: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

function isStreakActive(lastPlayDate: string | null, streak: number): boolean {
  if (streak <= 0 || !lastPlayDate) return false;
  const today = parisYmd();
  const yesterday = addCalendarDays(today, -1);
  return lastPlayDate === today || lastPlayDate === yesterday;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function emptyDayBuckets(days: number): { date: string; count: number }[] {
  const out: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * MS_DAY);
    out.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  return out;
}

function fillBuckets(users: User[], days: number): { date: string; count: number }[] {
  const buckets = emptyDayBuckets(days);
  const index = new Map(buckets.map((b, i) => [b.date, i]));
  const cutoff = Date.now() - days * MS_DAY;
  for (const u of users) {
    if (!u.created_at) continue;
    const t = new Date(u.created_at).getTime();
    if (t < cutoff) continue;
    const key = dayKey(u.created_at);
    const i = index.get(key);
    if (i != null) buckets[i].count += 1;
  }
  return buckets;
}

async function listAllUsers(admin: AdminClient): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const batch = data.users ?? [];
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
}

async function listAllDeckUserIds(admin: AdminClient): Promise<string[]> {
  const ids: string[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 100_000; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await admin
      .from('scanplay_decks')
      .select('user_id')
      .range(from, to);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as { user_id: string }[];
    for (const row of batch) {
      if (row.user_id) ids.push(row.user_id);
    }
    if (batch.length < pageSize) break;
  }
  return ids;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (!adminOk(req)) return res.status(401).json({ error: 'unauthorized' });

  const admin = tryGetSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: 'not_configured' });

  try {
    const [
      users,
      profilesRes,
      publicProfilesRes,
      deckUserIds,
      recentDecksRes,
      candidateDecksRes,
      testimonialsRes,
    ] = await Promise.all([
      listAllUsers(admin),
      admin
        .from('scanplay_profiles')
        .select(
          'user_id, plan, xp, streak, last_play_date, stripe_subscription_id, stripe_price_id, billing_cycle, subscription_period_end, subscription_cancel_at_period_end',
        ),
      admin.from('scanplay_public_profiles').select('user_id, display_name'),
      listAllDeckUserIds(admin),
      admin
        .from('scanplay_decks')
        .select('id, user_id, title, pairs, created_at')
        .order('created_at', { ascending: false })
        .limit(40),
      admin
        .from('scanplay_decks')
        .select('id, user_id, title, pairs, created_at')
        .order('created_at', { ascending: false })
        .limit(400),
      admin
        .from('scanplay_testimonials')
        .select(
          'id, created_at, author_name, role, rating, quote, email, locale, approved, source',
        )
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (publicProfilesRes.error) throw new Error(publicProfilesRes.error.message);
    if (recentDecksRes.error) throw new Error(recentDecksRes.error.message);
    if (candidateDecksRes.error) throw new Error(candidateDecksRes.error.message);
    if (testimonialsRes.error) throw new Error(testimonialsRes.error.message);

    const profiles = (profilesRes.data ?? []) as ProfileRow[];
    const publicProfiles = (publicProfilesRes.data ?? []) as PublicProfileRow[];
    const emailById = new Map(users.map((u) => [u.id, u.email ?? '(sans email)'] as const));
    const planById = new Map(profiles.map((p) => [p.user_id, p.plan] as const));
    const nameById = new Map(
      publicProfiles.map((p) => [p.user_id, p.display_name?.trim() || ''] as const),
    );

    const scanCountById = new Map<string, number>();
    for (const uid of deckUserIds) {
      scanCountById.set(uid, (scanCountById.get(uid) ?? 0) + 1);
    }

    const now = Date.now();
    const active24h = users.filter(
      (u) => u.last_sign_in_at && now - new Date(u.last_sign_in_at).getTime() <= MS_DAY,
    ).length;
    const active7d = users.filter(
      (u) => u.last_sign_in_at && now - new Date(u.last_sign_in_at).getTime() <= 7 * MS_DAY,
    ).length;

    const neverReturned = users.filter((u) => {
      if (!u.last_sign_in_at) return true;
      if (!u.created_at) return false;
      return (
        Math.abs(new Date(u.last_sign_in_at).getTime() - new Date(u.created_at).getTime()) <
        5 * 60 * 1000
      );
    });

    const cohort1d = users.filter(
      (u) => u.created_at && now - new Date(u.created_at).getTime() >= MS_DAY,
    );
    const retained1d = cohort1d.filter((u) => {
      if (!u.last_sign_in_at || !u.created_at) return false;
      return new Date(u.last_sign_in_at).getTime() - new Date(u.created_at).getTime() >= MS_DAY;
    }).length;

    const cohort7d = users.filter(
      (u) => u.created_at && now - new Date(u.created_at).getTime() >= 7 * MS_DAY,
    );
    const retained7d = cohort7d.filter((u) => {
      if (!u.last_sign_in_at || !u.created_at) return false;
      return new Date(u.last_sign_in_at).getTime() - new Date(u.created_at).getTime() >= 7 * MS_DAY;
    }).length;

    const planCounts: Record<string, number> = { free: 0, plus: 0, pro: 0, max: 0 };
    for (const p of profiles) {
      const plan = p.plan in planCounts ? p.plan : 'free';
      planCounts[plan] = (planCounts[plan] ?? 0) + 1;
    }
    const usersWithoutProfile = Math.max(0, users.length - profiles.length);
    if (usersWithoutProfile > 0) {
      planCounts.free = (planCounts.free ?? 0) + usersWithoutProfile;
    }

    const topByXp = [...profiles]
      .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0))
      .slice(0, 20)
      .map((p) => ({
        user_id: p.user_id,
        email: emailById.get(p.user_id) ?? p.user_id,
        display_name: nameById.get(p.user_id) || null,
        xp: p.xp ?? 0,
        level: levelFromXp(p.xp ?? 0),
        streak: p.streak ?? 0,
        plan: p.plan,
      }));

    const activeStreaks = profiles
      .filter((p) => isStreakActive(p.last_play_date, p.streak ?? 0))
      .sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0))
      .slice(0, 30)
      .map((p) => ({
        user_id: p.user_id,
        email: emailById.get(p.user_id) ?? p.user_id,
        display_name: nameById.get(p.user_id) || null,
        streak: p.streak ?? 0,
        last_play_date: p.last_play_date,
        xp: p.xp ?? 0,
      }));

    const mapDeck = (d: DeckRow) => ({
      id: d.id,
      created_at: d.created_at,
      user_id: d.user_id,
      email: emailById.get(d.user_id) ?? d.user_id,
      display_name: nameById.get(d.user_id) || null,
      title: d.title,
      notion_count: pairCount(d.pairs),
      cost_eur_est: roundEur(SCAN_COST_EUR),
    });

    const recentDecks = ((recentDecksRes.data ?? []) as DeckRow[]).map(mapDeck);
    const thinDecks = ((candidateDecksRes.data ?? []) as DeckRow[])
      .map(mapDeck)
      .filter((d) => d.notion_count < THIN_DECK_THRESHOLD)
      .slice(0, 40);

    const paidSubs = profiles
      .filter((p) => p.plan && p.plan !== 'free')
      .sort((a, b) => {
        const ae = a.subscription_period_end ? new Date(a.subscription_period_end).getTime() : 0;
        const be = b.subscription_period_end ? new Date(b.subscription_period_end).getTime() : 0;
        return be - ae;
      })
      .map((p) => ({
        user_id: p.user_id,
        email: emailById.get(p.user_id) ?? p.user_id,
        display_name: nameById.get(p.user_id) || null,
        plan: p.plan,
        billing_cycle: p.billing_cycle,
        stripe_subscription_id: p.stripe_subscription_id,
        stripe_price_id: p.stripe_price_id,
        subscription_period_end: p.subscription_period_end,
        cancel_at_period_end: Boolean(p.subscription_cancel_at_period_end),
      }));

    const recentSignups = [...users]
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      .slice(0, 25)
      .map((u) => ({
        email: u.email ?? '(sans email)',
        display_name: nameById.get(u.id) || null,
        created_at: u.created_at ?? null,
        provider: authProvider(u),
      }));

    const recentSignIns = [...users]
      .filter((u) => u.last_sign_in_at)
      .sort(
        (a, b) =>
          new Date(b.last_sign_in_at ?? 0).getTime() - new Date(a.last_sign_in_at ?? 0).getTime(),
      )
      .slice(0, 25)
      .map((u) => ({
        email: u.email ?? '(sans email)',
        display_name: nameById.get(u.id) || null,
        last_sign_in_at: u.last_sign_in_at ?? null,
      }));

    const userDetails = users
      .map((u) => {
        const scans = scanCountById.get(u.id) ?? 0;
        const plan = planById.get(u.id) ?? 'free';
        return {
          user_id: u.id,
          email: u.email ?? '(sans email)',
          display_name: nameById.get(u.id) || null,
          created_at: u.created_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          plan,
          scan_count: scans,
          cost_eur_est: roundEur(scans * SCAN_COST_EUR),
        };
      })
      .sort((a, b) => b.scan_count - a.scan_count);

    const totalScans = deckUserIds.length;
    const totalCostEur = roundEur(totalScans * SCAN_COST_EUR);
    const topCostUsers = userDetails.slice(0, 30);
    const freeHeavyUsers = userDetails
      .filter((u) => u.plan === 'free' && u.scan_count > 0)
      .slice(0, 30);

    const testimonials = (testimonialsRes.data ?? []) as TestimonialRow[];
    const emailQuota = await getQuotaSnapshot(admin);

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      email_quota: emailQuota,
      notes: {
        acquisition_source:
          'Pas de colonne source marketing. provider = auth (email/google/…).',
        retention:
          'Approximation via last_sign_in_at vs created_at (pas d historique de sessions).',
        thin_deck_threshold: THIN_DECK_THRESHOLD,
        cost:
          'Estimation uniquement: ' +
          SCAN_COST_EUR +
          ' EUR / deck (scanplay_decks). Tokens OpenAI reels non logges.',
      },
      cost_model: {
        scan_eur: SCAN_COST_EUR,
        unit: 'deck',
        real_openai_logged: false,
      },
      acquisition: {
        signups_7d: fillBuckets(users, 7),
        signups_30d: fillBuckets(users, 30),
        recent_signups: recentSignups,
      },
      connections: {
        active_24h: active24h,
        active_7d: active7d,
        recent_sign_ins: recentSignIns,
      },
      retention: {
        never_returned_count: neverReturned.length,
        never_returned: neverReturned
          .sort(
            (a, b) =>
              new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
          )
          .slice(0, 30)
          .map((u) => ({
            email: u.email ?? '(sans email)',
            display_name: nameById.get(u.id) || null,
            created_at: u.created_at ?? null,
            last_sign_in_at: u.last_sign_in_at ?? null,
          })),
        approx_j1: {
          cohort: cohort1d.length,
          retained: retained1d,
          rate: cohort1d.length ? Math.round((retained1d / cohort1d.length) * 1000) / 10 : null,
        },
        approx_j7: {
          cohort: cohort7d.length,
          retained: retained7d,
          rate: cohort7d.length ? Math.round((retained7d / cohort7d.length) * 1000) / 10 : null,
        },
      },
      engagement: {
        top_by_xp: topByXp,
        active_streaks: activeStreaks,
      },
      product_quality: {
        recent_decks: recentDecks,
        thin_decks: thinDecks,
        thin_threshold: THIN_DECK_THRESHOLD,
      },
      users: {
        details: userDetails,
      },
      costs: {
        total_scans: totalScans,
        total_cost_eur_est: totalCostEur,
        scan_eur: SCAN_COST_EUR,
        top_users: topCostUsers,
        free_heavy_users: freeHeavyUsers,
      },
      revenue: {
        plan_counts: planCounts,
        active_subscriptions: paidSubs,
      },
      feedback: {
        recent: testimonials,
      },
      totals: {
        users: users.length,
        profiles: profiles.length,
        decks: totalScans,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    console.error('admin-metrics', message);
    return res.status(500).json({ error: 'metrics_failed', detail: message });
  }
}
