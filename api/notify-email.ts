import type { VercelRequest, VercelResponse } from '@vercel/node';

import { getUserFromRequest, tryGetSupabaseAdmin } from './lib/auth.js';
import { sendClaimedMail } from './lib/lifecycleMail.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const admin = tryGetSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: 'supabase_not_configured' });

  const body = (req.body ?? {}) as { kind?: string; otherUserId?: string };
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
