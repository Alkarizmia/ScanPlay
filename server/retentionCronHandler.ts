import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { tryGetSupabaseAdmin } from './auth.js';
import {
  MAX_DEFER_DAYS,
  addCalendarDays,
  getQuotaSnapshot,
  parisYmd,
  remainingSendBudget,
  type QuotaSnapshot,
} from './emailQuota.js';
import {
  PRIORITY,
  buildRetentionMail,
  daysSince,
  inactivityAnchor,
  logEmailEvent,
  sendResendEmail,
  type RetentionMailKind,
} from './retentionMail.js';

const PURGE_WARN_DAYS = 95;
const PURGE_DELETE_DAYS = 100;

type Admin = SupabaseClient;

type QueueRow = {
  id: string;
  user_id: string;
  kind: string;
  dedupe_key: string;
  priority: number;
  eligible_on: string;
  deferred_days: number;
  status: string;
  meta: Record<string, unknown> | null;
};

function isCronAuthorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization ?? '';
  if (secret && auth === `Bearer ${secret}`) return true;
  const header = String(req.headers['x-admin-secret'] ?? '');
  const query = typeof req.query.secret === 'string' ? req.query.secret : '';
  return Boolean(secret && (query === secret || header === secret));
}

function flag(req: VercelRequest, name: string): boolean {
  const v = req.query[name];
  if (Array.isArray(v)) return v[0] === '1' || v[0] === 'true';
  return v === '1' || v === 'true';
}

export function retentionFlag(req: VercelRequest, name: string): boolean {
  return flag(req, name);
}

async function listUsers(admin: Admin): Promise<User[]> {
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

async function usersWithScans(admin: Admin): Promise<Set<string>> {
  const set = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; from < 100_000; from += pageSize) {
    const { data, error } = await admin
      .from('scanplay_decks')
      .select('user_id')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as { user_id: string }[];
    for (const row of batch) if (row.user_id) set.add(row.user_id);
    if (batch.length < pageSize) break;
  }
  return set;
}

function isPurgeEligibleFree(profile: {
  plan?: string | null;
  stripe_subscription_id?: string | null;
  subscription_period_end?: string | null;
}): boolean {
  const plan = profile.plan ?? 'free';
  if (plan !== 'free') return false;
  if (profile.stripe_subscription_id) return false;
  if (profile.subscription_period_end) {
    const end = new Date(profile.subscription_period_end).getTime();
    if (end > Date.now()) return false;
  }
  return true;
}

async function enqueue(
  admin: Admin,
  row: {
    userId: string;
    kind: RetentionMailKind;
    dedupeKey: string;
    eligibleOn: string;
    meta?: Record<string, unknown>;
  },
): Promise<boolean> {
  const priority = PRIORITY[row.kind] ?? 3;
  const { error } = await admin.from('scanplay_email_queue').upsert(
    {
      user_id: row.userId,
      kind: row.kind,
      dedupe_key: row.dedupeKey,
      priority,
      eligible_on: row.eligibleOn,
      status: 'pending',
      deferred_days: 0,
      meta: row.meta ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'dedupe_key', ignoreDuplicates: true },
  );
  if (error) {
    console.warn('enqueue', row.kind, error.message);
    return false;
  }
  return true;
}

async function discoverQueue(admin: Admin, today: string): Promise<{ enqueued: number; notes: string[] }> {
  const notes: string[] = [];
  let enqueued = 0;
  const [users, scanUsers, profilesRes] = await Promise.all([
    listUsers(admin),
    usersWithScans(admin),
    admin
      .from('scanplay_profiles')
      .select(
        'user_id, plan, locale, email_alerts, streak, last_play_date, streak_lost_value, streak_lost_at, stripe_subscription_id, subscription_period_end',
      ),
  ]);
  if (profilesRes.error) throw new Error(profilesRes.error.message);
  const profiles = profilesRes.data ?? [];
  const profileById = new Map(profiles.map((p) => [p.user_id as string, p]));

  // P1 purge warn J95
  for (const u of users) {
    const profile = profileById.get(u.id);
    if (!profile || !isPurgeEligibleFree(profile)) continue;
    if (profile.email_alerts === false) continue;
    const anchor = inactivityAnchor(u);
    if (!anchor) continue;
    const inactive = daysSince(anchor);
    if (inactive < PURGE_WARN_DAYS || inactive >= PURGE_DELETE_DAYS) continue;
    const key = `purge_warn_j95:${u.id}:${parisYmd(anchor)}`;
    if (
      await enqueue(admin, {
        userId: u.id,
        kind: 'purge_warn_j95',
        dedupeKey: key,
        eligibleOn: today,
        meta: { inactive_days: inactive },
      })
    ) {
      enqueued += 1;
    }
  }

  // P2/P3 reactivation — require ≥1 scan
  for (const u of users) {
    if (!scanUsers.has(u.id)) continue;
    const profile = profileById.get(u.id);
    if (profile && profile.email_alerts === false) continue;
    const anchor = inactivityAnchor(u);
    if (!anchor) continue;
    const inactive = daysSince(anchor);
    const tryKind = async (kind: RetentionMailKind, dayTarget: number) => {
      // Exact day window (inactivity since last_sign_in / created_at)
      if (inactive !== dayTarget) return;
      const eventDay = addCalendarDays(today, -dayTarget);
      const key = `${kind}:${u.id}:${eventDay}`;
      if (
        await enqueue(admin, {
          userId: u.id,
          kind,
          dedupeKey: key,
          eligibleOn: today,
          meta: { inactive_days: inactive },
        })
      ) {
        enqueued += 1;
      }
    };

    await tryKind('reactivate_j1', 1);
    await tryKind('reactivate_j3', 3);
    await tryKind('winback_j7', 7);
    await tryKind('winback_j14', 14);
  }

  // streak_lost: perte récente (streak_lost_at ms dans les ~36 h)
  const yesterday = addCalendarDays(today, -1);
  const lostWindowMs = 36 * 60 * 60 * 1000;
  const nowMs = Date.now();
  for (const p of profiles) {
    if (p.email_alerts === false) continue;
    const lostVal = Number(p.streak_lost_value ?? 0);
    const lostAt = Number(p.streak_lost_at ?? 0);
    if (lostVal < 1 || !lostAt || nowMs - lostAt > lostWindowMs) continue;
    if (!scanUsers.has(String(p.user_id))) continue;
    const key = `streak_lost:${p.user_id}:${yesterday}`;
    if (
      await enqueue(admin, {
        userId: String(p.user_id),
        kind: 'streak_lost',
        dedupeKey: key,
        eligibleOn: today,
        meta: { streak: lostVal },
      })
    ) {
      enqueued += 1;
    }
  }

  notes.push(`scan_users=${scanUsers.size}`);
  return { enqueued, notes };
}

async function processQueue(
  admin: Admin,
  opts: { sendMail: boolean; dryRun: boolean; budget: number; today: string },
): Promise<{
  sent: number;
  simulated: number;
  deferred: number;
  skipped_quota: number;
  actions: Array<Record<string, unknown>>;
}> {
  const actions: Array<Record<string, unknown>> = [];
  let sent = 0;
  let simulated = 0;
  let deferred = 0;
  let skipped_quota = 0;
  let budget = opts.budget;

  const { data: pending, error } = await admin
    .from('scanplay_email_queue')
    .select('id, user_id, kind, dedupe_key, priority, eligible_on, deferred_days, status, meta')
    .eq('status', 'pending')
    .lte('eligible_on', opts.today)
    .order('priority', { ascending: true })
    .order('eligible_on', { ascending: true })
    .limit(200);

  if (error) {
    // Table may not exist yet
    actions.push({ error: error.message, hint: 'Run supabase/patch-retention-email-queue.sql' });
    return { sent, simulated, deferred, skipped_quota, actions };
  }

  const rows = (pending ?? []) as QueueRow[];

  for (const row of rows) {
    const isP1 = row.priority <= 1;
    const isDroppable = row.priority >= 2;

    if (budget <= 0) {
      if (isDroppable) {
        const nextDeferred = (row.deferred_days ?? 0) + 1;
        if (nextDeferred > MAX_DEFER_DAYS) {
          if (!opts.dryRun) {
            await admin
              .from('scanplay_email_queue')
              .update({
                status: 'skipped_quota',
                deferred_days: nextDeferred,
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id);
            await logEmailEvent(admin, {
              userId: row.user_id,
              kind: row.kind,
              dedupeKey: `${row.dedupe_key}:skipped`,
              status: 'skipped_quota',
            });
          }
          skipped_quota += 1;
          actions.push({
            action: 'skipped_quota',
            kind: row.kind,
            user_id: row.user_id,
            deferred_days: nextDeferred,
          });
        } else {
          if (!opts.dryRun) {
            await admin
              .from('scanplay_email_queue')
              .update({
                deferred_days: nextDeferred,
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id);
          }
          deferred += 1;
          actions.push({
            action: 'deferred',
            kind: row.kind,
            user_id: row.user_id,
            deferred_days: nextDeferred,
          });
        }
      } else {
        // P1 still blocked by hard cap: defer without abandon
        if (!opts.dryRun) {
          await admin
            .from('scanplay_email_queue')
            .update({
              deferred_days: (row.deferred_days ?? 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
        }
        deferred += 1;
        actions.push({
          action: 'deferred_p1_quota',
          kind: row.kind,
          user_id: row.user_id,
          note: 'Préavis reporté (quota jour épuisé). Sera retenté demain.',
        });
      }
      continue;
    }

    const [{ data: userData }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(row.user_id),
      admin.from('scanplay_profiles').select('locale, email_alerts').eq('user_id', row.user_id).maybeSingle(),
    ]);
    const email = userData.user?.email;
    if (!email) {
      actions.push({ action: 'skip_no_email', user_id: row.user_id, kind: row.kind });
      continue;
    }
    // Préavis J95 = notice de service (toujours). Autres kinds respectent email_alerts.
    if (profile && profile.email_alerts === false && row.kind !== 'purge_warn_j95') {
      if (!opts.dryRun) {
        await admin
          .from('scanplay_email_queue')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', row.id);
      }
      actions.push({ action: 'cancelled_alerts_off', user_id: row.user_id, kind: row.kind });
      continue;
    }

    const mail = buildRetentionMail(row.kind as RetentionMailKind, profile?.locale, {
      streak: Number((row.meta as { streak?: number } | null)?.streak ?? 1),
    });

    if (!opts.sendMail || opts.dryRun) {
      simulated += 1;
      budget -= 1;
      actions.push({
        action: 'simulate_send',
        kind: row.kind,
        priority: row.priority,
        email,
        subject: mail.subject,
        is_p1: isP1,
      });
      continue;
    }

    const logStatus = await logEmailEvent(admin, {
      userId: row.user_id,
      kind: row.kind,
      dedupeKey: row.dedupe_key,
      status: 'sent',
    });
    if (logStatus === 'duplicate') {
      await admin
        .from('scanplay_email_queue')
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', row.id);
      actions.push({ action: 'already_sent', kind: row.kind, email });
      continue;
    }

    const ok = await sendResendEmail({
      to: email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    if (!ok) {
      actions.push({ action: 'resend_failed', kind: row.kind, email });
      continue;
    }

    await admin
      .from('scanplay_email_queue')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', row.id);
    sent += 1;
    budget -= 1;
    actions.push({ action: 'sent', kind: row.kind, email, priority: row.priority });
  }

  return { sent, simulated, deferred, skipped_quota, actions };
}

async function purgeDryRun(admin: Admin, today: string): Promise<{
  warn_candidates: Array<Record<string, unknown>>;
  delete_candidates: Array<Record<string, unknown>>;
}> {
  const users = await listUsers(admin);
  const { data: profiles } = await admin
    .from('scanplay_profiles')
    .select('user_id, plan, stripe_subscription_id, subscription_period_end, locale');
  const profileById = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));

  const warn_candidates: Array<Record<string, unknown>> = [];
  const delete_candidates: Array<Record<string, unknown>> = [];

  for (const u of users) {
    const profile = profileById.get(u.id) ?? { plan: 'free' };
    if (!isPurgeEligibleFree(profile)) continue;
    const anchor = inactivityAnchor(u);
    if (!anchor) continue;
    const inactive = daysSince(anchor);
    const row = {
      user_id: u.id,
      email: u.email ?? '(sans email)',
      plan: profile.plan ?? 'free',
      last_sign_in_at: u.last_sign_in_at ?? null,
      created_at: u.created_at ?? null,
      inactive_days: inactive,
    };
    if (inactive >= PURGE_DELETE_DAYS) delete_candidates.push(row);
    else if (inactive >= PURGE_WARN_DAYS) warn_candidates.push(row);
  }

  // Persist dry-run audit samples (not deletions)
  for (const c of delete_candidates.slice(0, 50)) {
    await admin.from('scanplay_account_purge_log').insert({
      user_id: c.user_id,
      email: c.email,
      plan: c.plan,
      last_sign_in_at: c.last_sign_in_at,
      reason: 'inactive_free_j100',
      dry_run: true,
      meta: { inactive_days: c.inactive_days, simulated_on: today },
    });
  }

  return { warn_candidates, delete_candidates };
}

export async function runRetentionPass(
  admin: Admin,
  opts: { sendMail: boolean; dryRun: boolean },
): Promise<Record<string, unknown>> {
  const today = parisYmd();
  let quota: QuotaSnapshot = await getQuotaSnapshot(admin);
  const discover = await discoverQueue(admin, today);
  const budget = remainingSendBudget(quota);

  const queueResult = await processQueue(admin, {
    sendMail: opts.sendMail,
    dryRun: opts.dryRun || !opts.sendMail,
    budget,
    today,
  });

  const purge = await purgeDryRun(admin, today);
  quota = await getQuotaSnapshot(admin);

  return {
    ok: true,
    mode: {
      dry_run: opts.dryRun || !opts.sendMail,
      send_mail: opts.sendMail,
      execute_purge: false,
      note: opts.sendMail
        ? 'Emails P1–P3 actifs (send_mail=1). Purge comptes toujours bloquée.'
        : 'Simulation uniquement. Passe send_mail=1 pour envoyer P1–P3. Purge bloquée.',
    },
    quota,
    discover,
    queue: {
      sent: queueResult.sent,
      simulated: queueResult.simulated,
      deferred: queueResult.deferred,
      skipped_quota: queueResult.skipped_quota,
      sample_actions: queueResult.actions.slice(0, 80),
      actions_total: queueResult.actions.length,
    },
    purge_dry_run: {
      warn_j95_count: purge.warn_candidates.length,
      delete_j100_count: purge.delete_candidates.length,
      warn_sample: purge.warn_candidates.slice(0, 30),
      delete_sample: purge.delete_candidates.slice(0, 30),
      note: 'Liste uniquement. Aucune suppression tant que go execute explicite.',
    },
    today,
  };
}

/** Mounted from /api/lifecycle-emails?mode=retention (Hobby plan: no extra function). */
export async function handleRetentionRequest(req: VercelRequest, res: VercelResponse) {
  if (!isCronAuthorized(req)) return res.status(401).json({ error: 'unauthorized' });

  const admin = tryGetSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: 'not_configured' });

  const sendMail = flag(req, 'send_mail') && !flag(req, 'dry_run');
  const dryRun = !sendMail;

  try {
    const payload = await runRetentionPass(admin, { sendMail, dryRun });
    return res.status(200).json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('retention-cron', message);
    return res.status(500).json({ error: 'retention_failed', detail: message });
  }
}
