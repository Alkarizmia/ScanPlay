import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest, tryGetSupabaseAdmin } from './lib/auth.js';
import { createScanPlayPortalSession } from './lib/scanplayBranding.js';
import { resolveStripeCustomerId, verifyStripeCustomerForUser } from './lib/subscriptionSync.js';
import { getAppUrl, getStripe } from './lib/stripe.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'unauthorized' });

    const customerId = await resolveStripeCustomerId(user.id, user.email);
    if (!customerId) {
      return res.status(400).json({ error: 'no_stripe_customer' });
    }

    const stripe = getStripe();
    const ownsCustomer = await verifyStripeCustomerForUser(stripe, customerId, user.id);
    if (!ownsCustomer) {
      return res.status(403).json({ error: 'no_stripe_customer' });
    }

    const supabase = tryGetSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase
        .from('scanplay_profiles')
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (error) {
        console.warn('create-portal-session: profile update skipped', error.message);
      }
    } else {
      console.warn('create-portal-session: SUPABASE_SERVICE_ROLE_KEY missing — portal still opens');
    }

    const appUrl = getAppUrl();
    const portal = await createScanPlayPortalSession(stripe, customerId, appUrl);

    if (!portal.url) {
      return res.status(500).json({ error: 'portal_url_missing' });
    }

    return res.status(200).json({ url: portal.url });
  } catch (err) {
    console.error('create-portal-session', err);
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('STRIPE_SECRET_KEY')) {
      return res.status(503).json({ error: 'stripe_not_configured' });
    }
    return res.status(500).json({ error: 'internal_error', detail: message.slice(0, 200) });
  }
}
