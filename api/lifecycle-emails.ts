import type { VercelRequest, VercelResponse } from '@vercel/node';

import { tryGetSupabaseAdmin } from './lib/auth.js';
import {
  addCalendarDays,
  parisYmd,
  sendClaimedMail,
} from './lib/lifecycleMail.js';

function isAuthorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization ?? '';
  if (secret && auth === `Bearer ${secret}`) return true;
  const query = typeof req.query.secret === 'string' ? req.query.secret : '';
  if (secret && query === secret) return true;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isAuthorized(req)) {
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

  if (streakErr) {
    console.warn('lifecycle streak query', streakErr.message);
  }

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

  if (socialErr) {
    console.warn('lifecycle social query', socialErr.message);
  }

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
