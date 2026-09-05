import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getUserFromRequest, tryGetSupabaseAdmin } from '../server/auth.js';
import { getAppUrl } from '../server/stripe.js';

type MailKind = 'streak' | 'friend_request' | 'friend_accepted';

const FROM_EMAIL = 'ScanPlay <support@scanplay.org>';

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

function isCronAuthorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization ?? '';
  if (secret && auth === `Bearer ${secret}`) return true;
  const query = typeof req.query.secret === 'string' ? req.query.secret : '';
  return Boolean(secret && query === secret);
}

async function sendResendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [params.to],
      subject: params.subject,
      text: params.text,
      html: params.html,
    }),
  });
  if (!res.ok) {
    console.warn('resend failed', res.status, await res.text().catch(() => ''));
  }
  return res.ok;
}

function parseBody(req: VercelRequest): { kind?: string; otherUserId?: string } {
  const raw = req.body as unknown;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as { kind?: string; otherUserId?: string };
    } catch {
      return {};
    }
  }
  return raw as { kind?: string; otherUserId?: string };
}

function isFrench(locale?: string | null): boolean {
  const tag = (locale ?? 'fr').toLowerCase();
  return tag === 'fr' || tag.startsWith('fr-');
}

function wrapHtml(title: string, body: string, cta: string): string {
  const url = (getAppUrl() || 'https://scanplay.org').replace(/\/$/, '');
  const logo = `${url}/logo.png`;
  return `<!doctype html>
<html><body style="margin:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:24px auto;padding:28px;background:#fff;border-radius:16px;border:1px solid #e2e8f0;">
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
      <tr>
        <td style="vertical-align:middle;padding:0 10px 0 0;">
          <img src="${logo}" alt="ScanPlay" width="40" height="40" style="display:block;border:0;border-radius:10px;" />
        </td>
        <td style="vertical-align:middle;font-weight:800;color:#16a34a;font-size:18px;">ScanPlay</td>
      </tr>
    </table>
    <h1 style="margin:0 0 12px;font-size:1.35rem;">${title}</h1>
    <p style="margin:0 0 20px;line-height:1.55;color:#334155;">${body}</p>
    <p><a href="${url}" style="display:inline-block;padding:12px 18px;background:#58cc02;color:#14350c;font-weight:800;text-decoration:none;border-radius:12px;">${cta}</a></p>
  </div>
</body></html>`;
}

function buildLifecycleMail(
  kind: MailKind,
  locale: string | null | undefined,
  extra: { streak?: number; fromName?: string },
): { subject: string; text: string; html: string } {
  const fr = isFrench(locale);
  const url = getAppUrl() || 'https://scanplay.org';
  const name = extra.fromName?.trim() || (fr ? 'Un joueur' : 'A player');
  const days = extra.streak ?? 1;

  if (kind === 'streak') {
    const subject = fr
      ? `Ta série de ${days} jour${days > 1 ? 's' : ''} va tomber`
      : `Your ${days}-day streak is about to drop`;
    const title = fr ? 'Ta série est en danger' : 'Your streak is at risk';
    const body = fr
      ? `Tu n’as pas encore joué aujourd’hui. Une partie avant minuit garde ta série de ${days} jour${days > 1 ? 's' : ''}.`
      : `You haven’t played yet today. One game before midnight keeps your ${days}-day streak.`;
    const cta = fr ? 'Jouer maintenant' : 'Play now';
    return { subject, text: `${body}\n\n${url}`, html: wrapHtml(title, body, cta) };
  }

  if (kind === 'friend_request') {
    const subject = fr ? `${name} t’ajoute sur ScanPlay` : `${name} added you on ScanPlay`;
    const title = fr ? 'Nouvelle demande d’ami' : 'New friend request';
    const body = fr
      ? `${name} veut te rejoindre. Ouvre ScanPlay pour accepter et réviser ensemble.`
      : `${name} wants to connect. Open ScanPlay to accept and study together.`;
    const cta = fr ? 'Voir la demande' : 'See the request';
    return { subject, text: `${body}\n\n${url}`, html: wrapHtml(title, body, cta) };
  }

  const subject = fr ? `${name} a accepté ta demande` : `${name} accepted your request`;
  const title = fr ? 'Vous êtes amis' : 'You’re friends now';
  const body = fr
    ? `${name} a accepté. Retrouve son profil et sa série dans l’onglet Amis.`
    : `${name} accepted. Find their profile and streak in the Friends tab.`;
  const cta = fr ? 'Ouvrir ScanPlay' : 'Open ScanPlay';
  return { subject, text: `${body}\n\n${url}`, html: wrapHtml(title, body, cta) };
}

async function sendClaimedMail(
  admin: SupabaseClient,
  toUserId: string,
  kind: MailKind,
  dedupeKey: string,
  extra: { streak?: number; fromName?: string },
  options?: { ignoreAlerts?: boolean },
): Promise<boolean> {
  const [{ data: userData }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(toUserId),
    admin.from('scanplay_profiles').select('locale, email_alerts').eq('user_id', toUserId).maybeSingle(),
  ]);

  const email = userData.user?.email;
  if (!email) return false;
  if (!options?.ignoreAlerts && profile && profile.email_alerts === false) return false;

  const { error } = await admin.from('scanplay_email_log').insert({
    user_id: toUserId,
    kind,
    dedupe_key: dedupeKey,
  });
  if (error) {
    if (error.code === '23505') return false;
    console.warn('email log insert', error.message);
  }

  const mail = buildLifecycleMail(kind, profile?.locale as string | undefined, extra);
  const sent = await sendResendEmail({
    to: email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  if (!sent) {
    await admin.from('scanplay_email_log').delete().eq('dedupe_key', dedupeKey);
  }
  return sent;
}

async function handleFriendNotify(req: VercelRequest, res: VercelResponse) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const admin = tryGetSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: 'supabase_not_configured' });

  const body = parseBody(req);
  const otherUserId = body.otherUserId?.trim();
  if (!otherUserId) return res.status(400).json({ error: 'invalid_payload' });

  if (body.kind === 'friend_request') {
    const { data: reqRow } = await admin
      .from('scanplay_friend_requests')
      .select('id, status')
      .eq('from_user_id', user.id)
      .eq('to_user_id', otherUserId)
      .eq('status', 'pending')
      .maybeSingle();
    if (!reqRow) return res.status(403).json({ error: 'no_pending_request' });

    const { data: me } = await admin
      .from('scanplay_public_profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const sent = await sendClaimedMail(
      admin,
      otherUserId,
      'friend_request',
      `friend_request:${reqRow.id}`,
      { fromName: String(me?.display_name ?? '') },
    );
    return res.status(200).json({ ok: sent });
  }

  if (body.kind === 'friend_accepted') {
    const { data: reqRow } = await admin
      .from('scanplay_friend_requests')
      .select('id, status')
      .eq('from_user_id', otherUserId)
      .eq('to_user_id', user.id)
      .eq('status', 'accepted')
      .maybeSingle();
    if (!reqRow) return res.status(403).json({ error: 'not_friends' });

    const { data: me } = await admin
      .from('scanplay_public_profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const sent = await sendClaimedMail(
      admin,
      otherUserId,
      'friend_accepted',
      `friend_accepted:${otherUserId}:${user.id}`,
      { fromName: String(me?.display_name ?? '') },
    );
    return res.status(200).json({ ok: sent });
  }

  return res.status(400).json({ error: 'invalid_kind' });
}

async function handleCron(req: VercelRequest, res: VercelResponse) {
  if (!isCronAuthorized(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const admin = tryGetSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: 'supabase_not_configured' });
  }

  const today = parisYmd();
  const yesterday = addCalendarDays(today, -1);
  let streakSent = 0;
  let socialSent = 0;

  const { data: atRisk, error: streakErr } = await admin
    .from('scanplay_profiles')
    .select('user_id, streak, locale')
    .gte('streak', 1)
    .eq('last_play_date', yesterday)
    .neq('email_alerts', false)
    .limit(60);

  if (streakErr) console.warn('lifecycle streak query', streakErr.message);

  for (const row of atRisk ?? []) {
    const userId = String(row.user_id);
    const ok = await sendClaimedMail(admin, userId, 'streak', `streak:${userId}:${today}`, {
      streak: Number(row.streak ?? 1),
    });
    if (ok) streakSent += 1;
  }

  const { data: notifs, error: socialErr } = await admin
    .from('scanplay_social_notifications')
    .select('id, user_id, kind, payload')
    .in('kind', ['friend_request', 'friend_accepted'])
    .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .limit(40);

  if (socialErr) console.warn('lifecycle social query', socialErr.message);

  for (const row of notifs ?? []) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const kind = row.kind === 'friend_accepted' ? 'friend_accepted' : 'friend_request';
    const requestId = payload.request_id ? String(payload.request_id) : String(row.id);
    const fromId = payload.from_user_id ? String(payload.from_user_id) : '';
    const dedupe =
      kind === 'friend_request'
        ? `friend_request:${requestId}`
        : `friend_accepted:${row.user_id}:${fromId}`;
    const ok = await sendClaimedMail(admin, String(row.user_id), kind, dedupe, {
      fromName: String(payload.from_display_name ?? ''),
    });
    if (ok) socialSent += 1;
  }

  return res.status(200).json({ ok: true, today, streakSent, socialSent });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    const body = parseBody(req);
    if (body.kind === 'friend_request' || body.kind === 'friend_accepted') {
      return handleFriendNotify(req, res);
    }
  }
  if (req.method === 'GET' || req.method === 'POST') {
    return handleCron(req, res);
  }
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method_not_allowed' });
}
