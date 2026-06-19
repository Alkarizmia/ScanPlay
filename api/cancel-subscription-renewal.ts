import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from './lib/auth.js';
import { cancelSubscriptionRenewal } from './lib/subscriptionSync.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'unauthorized' });

    const fields = await cancelSubscriptionRenewal(user.id);
    if (!fields) {
      return res.status(400).json({ error: 'no_active_subscription' });
    }

    return res.status(200).json({ ok: true, subscription: fields });
  } catch (err) {
    console.error('cancel-subscription-renewal', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
