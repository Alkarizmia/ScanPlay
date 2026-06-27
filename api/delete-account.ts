import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, getUserFromRequest } from './lib/auth.js';

const USER_TABLES = [
  'scanplay_exam_history',
  'scanplay_mistakes',
  'scanplay_decks',
  'scanplay_user_stats',
  'scanplay_profiles',
] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const admin = getSupabaseAdmin();
  const userId = user.id;

  try {
    for (const table of USER_TABLES) {
      await admin.from(table).delete().eq('user_id', userId);
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      return res.status(500).json({ error: 'delete_failed', detail: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: 'delete_failed', detail: message });
  }
}
