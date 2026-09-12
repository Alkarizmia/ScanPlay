import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, getUserFromRequest } from '../server/auth.js';

const USER_ID_TABLES = [
  'scanplay_exam_history',
  'scanplay_mistakes',
  'scanplay_decks',
  'scanplay_user_stats',
  'scanplay_wallets',
  'scanplay_public_profiles',
  'scanplay_coach_chat_messages',
  'scanplay_coach_chat_usage',
  'scanplay_email_log',
  'scanplay_social_notifications',
  'scanplay_room_players',
  'scanplay_profiles',
] as const;

function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  );
}

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
    const { data: profile } = await admin
      .from('scanplay_profiles')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .maybeSingle();

    const subscriptionId =
      profile && typeof profile.stripe_subscription_id === 'string'
        ? profile.stripe_subscription_id
        : null;

    if (subscriptionId && process.env.STRIPE_SECRET_KEY) {
      try {
        const { getStripe } = await import('../server/stripe.js');
        await getStripe().subscriptions.cancel(subscriptionId);
      } catch {
        console.error('delete-account: stripe subscription cancel failed');
      }
    }

    for (const table of USER_ID_TABLES) {
      const { error } = await admin.from(table).delete().eq('user_id', userId);
      if (error && !isMissingRelation(error)) {
        console.error('delete-account: table delete failed', table);
      }
    }

    const extra: Array<PromiseLike<{ error: { code?: string } | null }>> = [
      admin.from('scanplay_friend_requests').delete().eq('from_user_id', userId),
      admin.from('scanplay_friend_requests').delete().eq('to_user_id', userId),
      admin.from('scanplay_follows').delete().eq('follower_id', userId),
      admin.from('scanplay_follows').delete().eq('following_id', userId),
      admin.from('scanplay_rooms').delete().eq('host_id', userId),
      admin.from('scanplay_coin_transfers').delete().eq('from_user_id', userId),
      admin.from('scanplay_coin_transfers').delete().eq('to_user_id', userId),
    ];
    const extraResults = await Promise.all(extra);
    for (const result of extraResults) {
      if (result.error && !isMissingRelation(result.error)) {
        console.error('delete-account: relation delete failed');
      }
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      return res.status(500).json({ error: 'delete_failed' });
    }

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'delete_failed' });
  }
}
