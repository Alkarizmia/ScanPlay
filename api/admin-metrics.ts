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

const MAX_COINS = 999_999;
const MAX_GEMS = 99_999;

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-admin-secret, authorization');
}

function parseAmount(raw: unknown, max: number): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0 || n > max || !Number.isInteger(n)) return null;
  return n;
}

async function saveAdminNote(req: VercelRequest, res: VercelResponse, admin: AdminClient) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const userId = String(body.userId ?? body.user_id ?? '').trim();
  if (!userId || userId.length < 10) {
    return res.status(400).json({ error: 'user_id_required' });
  }
  const notes = String(body.notes ?? '');
  if (notes.length > 20_000) {
    return res.status(400).json({ error: 'notes_too_long' });
  }

  const { error } = await admin.from('scanplay_admin_user_notes').upsert(
    {
      user_id: userId,
      notes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    return res.status(500).json({
      error: 'notes_save_failed',
      detail: error.message,
      hint: 'Exécute supabase/patch-admin-user-notes.sql',
    });
  }
  return res.status(200).json({ ok: true, user_id: userId, notes });
}

async function grantWallet(req: VercelRequest, res: VercelResponse, admin: AdminClient) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const displayName = String(body.displayName ?? body.display_name ?? '').trim();
  if (displayName.length < 2) {
    return res.status(400).json({ error: 'display_name_required' });
  }

  const coins = parseAmount(body.coins, MAX_COINS);
  const gems = parseAmount(body.gems, MAX_GEMS);
  if (coins == null && gems == null) {
    return res.status(400).json({ error: 'coins_or_gems_required' });
  }
  if (body.coins != null && body.coins !== '' && coins == null) {
    return res.status(400).json({ error: 'invalid_coins' });
  }
  if (body.gems != null && body.gems !== '' && gems == null) {
    return res.status(400).json({ error: 'invalid_gems' });
  }

  const { data: profile, error: findErr } = await admin
    .from('scanplay_public_profiles')
    .select('user_id, display_name')
    .ilike('display_name', displayName)
    .limit(5);

  if (findErr) return res.status(500).json({ error: findErr.message });

  const rows = (profile ?? []) as { user_id: string; display_name: string }[];
  const exact = rows.filter(
    (r) => r.display_name.trim().toLowerCase() === displayName.toLowerCase(),
  );
  if (exact.length === 0) {
    return res.status(404).json({ error: 'user_not_found', query: displayName });
  }
  if (exact.length > 1) {
    return res.status(409).json({
      error: 'ambiguous_name',
      matches: exact.map((r) => r.display_name),
    });
  }

  const userId = exact[0]!.user_id;
  const resolvedName = exact[0]!.display_name;

  if (coins != null) {
    const { error: walletErr } = await admin.from('scanplay_wallets').upsert(
      { user_id: userId, coins, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    if (walletErr) return res.status(500).json({ error: walletErr.message });
  }

  const { data: statsRow, error: statsReadErr } = await admin
    .from('scanplay_user_stats')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  if (statsReadErr) return res.status(500).json({ error: statsReadErr.message });

  const prevData =
    statsRow?.data && typeof statsRow.data === 'object' && !Array.isArray(statsRow.data)
      ? (statsRow.data as Record<string, unknown>)
      : {};
  const prevWallet =
    prevData.wallet && typeof prevData.wallet === 'object' && !Array.isArray(prevData.wallet)
      ? (prevData.wallet as Record<string, unknown>)
      : {};

  const nextWallet: Record<string, unknown> = { ...prevWallet };
  if (coins != null) nextWallet.coins = coins;
  if (gems != null) nextWallet.gems = gems;

  const { error: statsWriteErr } = await admin.from('scanplay_user_stats').upsert(
    {
      user_id: userId,
      data: { ...prevData, wallet: nextWallet },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (statsWriteErr) return res.status(500).json({ error: statsWriteErr.message });

  return res.status(200).json({
    ok: true,
    user_id: userId,
    display_name: resolvedName,
    coins: coins ?? Number(prevWallet.coins ?? 0),
    gems: gems ?? Number(prevWallet.gems ?? 0),
    updated: { coins: coins != null, gems: gems != null },
  });
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

/** Calendar YYYY-MM-DD in Belgium (Europe/Brussels). Same offset as Paris. */
function brusselsYmd(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parisYmd(date = new Date()): string {
  return brusselsYmd(date);
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

function emptyDayBuckets(days: number): { date: string; count: number }[] {
  const out: { date: string; count: number }[] = [];
  const today = brusselsYmd();
  for (let i = days - 1; i >= 0; i -= 1) {
    out.push({ date: addCalendarDays(today, -i), count: 0 });
  }
  return out;
}

function fillBuckets(users: User[], days: number): { date: string; count: number }[] {
  const buckets = emptyDayBuckets(days);
  const index = new Map(buckets.map((b, i) => [b.date, i]));
  const oldest = buckets[0]?.date;
  if (!oldest) return buckets;
  for (const u of users) {
    if (!u.created_at) continue;
    const key = brusselsYmd(new Date(u.created_at));
    if (key < oldest) continue;
    const i = index.get(key);
    if (i != null) buckets[i].count += 1;
  }
  return buckets;
}

function mapSignup(u: User, nameById: Map<string, string>) {
  return {
    email: u.email ?? '(sans email)',
    display_name: nameById.get(u.id) || null,
    created_at: u.created_at ?? null,
    provider: authProvider(u),
  };
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

type DeckLite = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  notion_count: number;
};

async function listAllDecksLite(admin: AdminClient): Promise<DeckLite[]> {
  const out: DeckLite[] = [];
  const pageSize = 500;
  for (let from = 0; from < 100_000; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await admin
      .from('scanplay_decks')
      .select('id, user_id, title, pairs, created_at')
      .order('created_at', { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as DeckRow[];
    for (const row of batch) {
      if (!row.user_id) continue;
      out.push({
        id: String(row.id),
        user_id: row.user_id,
        title: String(row.title ?? ''),
        created_at: String(row.created_at ?? ''),
        notion_count: pairCount(row.pairs),
      });
    }
    if (batch.length < pageSize) break;
  }
  return out;
}

function neverReturnedUser(u: User): boolean {
  if (!u.last_sign_in_at) return true;
  if (!u.created_at) return false;
  return (
    Math.abs(new Date(u.last_sign_in_at).getTime() - new Date(u.created_at).getTime()) <
    5 * 60 * 1000
  );
}

/** Calendar-day gap (ymd - ymd), non-negative when b >= a. */
function calendarDaysBetween(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split('-').map(Number);
  const [ty, tm, td] = toYmd.split('-').map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.floor((b - a) / MS_DAY);
}

/**
 * Play retention: last_play_date (YYYY-MM-DD from gamification) is on or after
 * signup calendar day (Europe/Brussels) + minDays.
 */
function retainedByPlay(
  createdAt: string | null | undefined,
  lastPlayDate: string | null | undefined,
  minDays: number,
): boolean {
  if (!createdAt || !lastPlayDate) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastPlayDate)) return false;
  const signupYmd = brusselsYmd(new Date(createdAt));
  const threshold = addCalendarDays(signupYmd, minDays);
  return lastPlayDate >= threshold;
}

function retainedBySignIn(
  createdAt: string | null | undefined,
  lastSignInAt: string | null | undefined,
  minDays: number,
): boolean {
  if (!createdAt || !lastSignInAt) return false;
  return new Date(lastSignInAt).getTime() - new Date(createdAt).getTime() >= minDays * MS_DAY;
}

type RetentionSlice = {
  cohort: number;
  retained: number;
  rate: number | null;
};

function retentionSlice(cohortSize: number, retained: number): RetentionSlice {
  return {
    cohort: cohortSize,
    retained,
    rate: cohortSize ? Math.round((retained / cohortSize) * 1000) / 10 : null,
  };
}

type Day7Cohort = {
  date: string;
  cohort: number;
  retained_play: number;
  retained_signin: number;
  rate_play: number | null;
  rate_signin: number | null;
};

/** Mature signup days (age ≥ 7d) over the last `windowDays` calendar days. */
function buildPlayJ7Cohorts(
  users: User[],
  playByUser: Map<string, string | null>,
  windowDays: number,
): Day7Cohort[] {
  const today = brusselsYmd();
  const out: Day7Cohort[] = [];
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const date = addCalendarDays(today, -i);
    const ageDays = calendarDaysBetween(date, today);
    if (ageDays < 7) continue;

    let cohort = 0;
    let retainedPlay = 0;
    let retainedSignin = 0;
    for (const u of users) {
      if (!u.created_at) continue;
      if (brusselsYmd(new Date(u.created_at)) !== date) continue;
      cohort += 1;
      if (retainedByPlay(u.created_at, playByUser.get(u.id) ?? null, 7)) retainedPlay += 1;
      if (retainedBySignIn(u.created_at, u.last_sign_in_at, 7)) retainedSignin += 1;
    }
    out.push({
      date,
      cohort,
      retained_play: retainedPlay,
      retained_signin: retainedSignin,
      rate_play: cohort ? Math.round((retainedPlay / cohort) * 1000) / 10 : null,
      rate_signin: cohort ? Math.round((retainedSignin / cohort) * 1000) / 10 : null,
    });
  }
  return out;
}

function buildUserInsights(input: {
  neverReturned: boolean;
  scanCount: number;
  firstNotionCount: number | null;
  activityDays: number;
}): string[] {
  const insights: string[] = [];
  const first = input.firstNotionCount;
  if (input.neverReturned && input.scanCount === 0) {
    insights.push('Jamais revenu · aucun scan effectué.');
  } else if (input.neverReturned && first != null && first <= 2) {
    insights.push(
      `Jamais revenu · 1er scan = ${first} notion${first === 1 ? '' : 's'} seulement (sous-extraction).`,
    );
  } else if (input.neverReturned && first != null && first < THIN_DECK_THRESHOLD) {
    insights.push(
      `Jamais revenu · 1er scan mince (${first} notions, seuil ${THIN_DECK_THRESHOLD}).`,
    );
  } else if (input.neverReturned) {
    insights.push('Jamais revenu après inscription (last_sign_in ≈ created_at).');
  }
  if (!input.neverReturned && first != null && first <= 2) {
    insights.push(`1er scan très faible (${first} notions) : risque de frustration au début.`);
  }
  if (input.activityDays <= 1 && input.scanCount > 0 && !input.neverReturned) {
    insights.push('Activité concentrée sur 1 seul jour (peu de retours mesurés via scans).');
  }
  return insights;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!adminOk(req)) return res.status(401).json({ error: 'unauthorized' });

  const admin = tryGetSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: 'not_configured' });

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = String(body.action ?? 'grant');
    if (action === 'save_note') return saveAdminNote(req, res, admin);
    return grantWallet(req, res, admin);
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const [
      users,
      profilesRes,
      publicProfilesRes,
      allDecks,
      recentDecksRes,
      candidateDecksRes,
      testimonialsRes,
      notesRes,
    ] = await Promise.all([
      listAllUsers(admin),
      admin
        .from('scanplay_profiles')
        .select(
          'user_id, plan, xp, streak, last_play_date, stripe_subscription_id, stripe_price_id, billing_cycle, subscription_period_end, subscription_cancel_at_period_end',
        ),
      admin.from('scanplay_public_profiles').select('user_id, display_name'),
      listAllDecksLite(admin),
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
      admin.from('scanplay_admin_user_notes').select('user_id, notes, updated_at'),
    ]);

    const notesById = new Map<string, { notes: string; updated_at: string | null }>();
    const notesError = notesRes.error;
    if (!notesError && Array.isArray(notesRes.data)) {
      for (const row of notesRes.data as { user_id: string; notes: string; updated_at: string | null }[]) {
        notesById.set(row.user_id, {
          notes: String(row.notes ?? ''),
          updated_at: row.updated_at ?? null,
        });
      }
    }

    const decksByUser = new Map<string, DeckLite[]>();
    for (const d of allDecks) {
      const list = decksByUser.get(d.user_id);
      if (list) list.push(d);
      else decksByUser.set(d.user_id, [d]);
    }
    const deckUserIds = allDecks.map((d) => d.user_id);

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

    const neverReturned = users.filter((u) => neverReturnedUser(u));

    const playByUser = new Map(
      profiles.map((p) => [p.user_id, p.last_play_date ?? null] as const),
    );
    const todayBeForRetention = brusselsYmd();

    const cohort1d = users.filter(
      (u) => u.created_at && calendarDaysBetween(brusselsYmd(new Date(u.created_at)), todayBeForRetention) >= 1,
    );
    const cohort7d = users.filter(
      (u) => u.created_at && calendarDaysBetween(brusselsYmd(new Date(u.created_at)), todayBeForRetention) >= 7,
    );

    const approxJ1 = retentionSlice(
      cohort1d.length,
      cohort1d.filter((u) => retainedBySignIn(u.created_at, u.last_sign_in_at, 1)).length,
    );
    const approxJ7 = retentionSlice(
      cohort7d.length,
      cohort7d.filter((u) => retainedBySignIn(u.created_at, u.last_sign_in_at, 7)).length,
    );
    const playJ1 = retentionSlice(
      cohort1d.length,
      cohort1d.filter((u) => retainedByPlay(u.created_at, playByUser.get(u.id) ?? null, 1)).length,
    );
    const playJ7 = retentionSlice(
      cohort7d.length,
      cohort7d.filter((u) => retainedByPlay(u.created_at, playByUser.get(u.id) ?? null, 7)).length,
    );

    const playActive7d = profiles.filter((p) => {
      if (!p.last_play_date) return false;
      const age = calendarDaysBetween(p.last_play_date, todayBeForRetention);
      return age >= 0 && age <= 6;
    }).length;

    const j7Cohorts = buildPlayJ7Cohorts(users, playByUser, 21);

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

    const todayBe = brusselsYmd();
    const cutoff48h = now - 2 * MS_DAY;
    const sortedByCreated = [...users].sort(
      (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
    );
    const recentSignups = sortedByCreated.slice(0, 25).map((u) => mapSignup(u, nameById));
    const signupsToday = sortedByCreated
      .filter((u) => u.created_at && brusselsYmd(new Date(u.created_at)) === todayBe)
      .map((u) => mapSignup(u, nameById));
    const signups48h = sortedByCreated
      .filter((u) => u.created_at && new Date(u.created_at).getTime() >= cutoff48h)
      .map((u) => mapSignup(u, nameById));

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

    const profileById = new Map(profiles.map((p) => [p.user_id, p] as const));

    const userDetails = users
      .map((u) => {
        const scans = scanCountById.get(u.id) ?? 0;
        const plan = planById.get(u.id) ?? 'free';
        const profile = profileById.get(u.id);
        const decks = decksByUser.get(u.id) ?? [];
        const first = decks[0] ?? null;
        const activityDays = new Set(
          decks
            .map((d) => (d.created_at ? brusselsYmd(new Date(d.created_at)) : ''))
            .filter(Boolean),
        ).size;
        const signupDay = u.created_at ? brusselsYmd(new Date(u.created_at)) : null;
        const never = neverReturnedUser(u);
        const createdMs = u.created_at ? new Date(u.created_at).getTime() : 0;
        const lastMs = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
        const daysSinceSignup =
          createdMs > 0 ? Math.max(0, Math.floor((now - createdMs) / MS_DAY)) : null;
        const daysSinceLastSignIn =
          lastMs > 0 ? Math.max(0, Math.floor((now - lastMs) / MS_DAY)) : null;
        // Jours d'activité scan hors jour d'inscription ≈ retours mesurés
        const returnVisitsApprox = Math.max(
          0,
          [...new Set(
            decks
              .map((d) => (d.created_at ? brusselsYmd(new Date(d.created_at)) : ''))
              .filter((d) => d && d !== signupDay),
          )].length,
        );
        const firstNotion = first ? first.notion_count : null;
        const insights = buildUserInsights({
          neverReturned: never,
          scanCount: scans,
          firstNotionCount: firstNotion,
          activityDays,
        });
        const note = notesById.get(u.id);
        return {
          user_id: u.id,
          email: u.email ?? '(sans email)',
          display_name: nameById.get(u.id) || null,
          created_at: u.created_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          provider: authProvider(u),
          plan,
          xp: profile?.xp ?? 0,
          level: levelFromXp(profile?.xp ?? 0),
          streak: profile?.streak ?? 0,
          last_play_date: profile?.last_play_date ?? null,
          scan_count: scans,
          cost_eur_est: roundEur(scans * SCAN_COST_EUR),
          never_returned: never,
          days_since_signup: daysSinceSignup,
          days_since_last_sign_in: daysSinceLastSignIn,
          activity_days: activityDays,
          return_visits_approx: returnVisitsApprox,
          first_scan: first
            ? {
                id: first.id,
                title: first.title,
                created_at: first.created_at,
                notion_count: first.notion_count,
              }
            : null,
          decks: decks
            .slice()
            .reverse()
            .slice(0, 25)
            .map((d) => ({
              id: d.id,
              title: d.title,
              created_at: d.created_at,
              notion_count: d.notion_count,
            })),
          insights,
          admin_notes: note?.notes ?? '',
          admin_notes_updated_at: note?.updated_at ?? null,
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
          'Pas de colonne source marketing. provider = auth (email/google/...). Jours et listes en heure Belgique (Europe/Brussels).',
        retention:
          'J+7 jeu: last_play_date >= jour inscription (Europe/Brussels) + 7. J+7 connexion: last_sign_in_at - created_at >= 7j. Pas d historique de sessions GA.',
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
        timezone: 'Europe/Brussels',
        today_ymd: todayBe,
        signups_7d: fillBuckets(users, 7),
        signups_30d: fillBuckets(users, 30),
        signups_today_count: signupsToday.length,
        signups_48h_count: signups48h.length,
        signups_today: signupsToday,
        signups_48h: signups48h,
        recent_signups: recentSignups,
      },
      connections: {
        active_24h: active24h,
        active_7d: active7d,
        recent_sign_ins: recentSignIns,
      },
      retention: {
        timezone: 'Europe/Brussels',
        definition: {
          play_j7:
            'Compte créé il y a au moins 7 jours calendaires (BE). Retenu si last_play_date >= jour d inscription + 7.',
          signin_j7:
            'Meme cohorte. Retenu si last_sign_in_at - created_at >= 7 × 24h (approximation Auth).',
        },
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
            last_play_date: playByUser.get(u.id) ?? null,
          })),
        play_active_7d: playActive7d,
        play_j1: playJ1,
        play_j7: playJ7,
        approx_j1: approxJ1,
        approx_j7: approxJ7,
        j7_cohorts: j7Cohorts,
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
        notes_table_ok: !notesError,
        notes_table_error: notesError?.message ?? null,
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
