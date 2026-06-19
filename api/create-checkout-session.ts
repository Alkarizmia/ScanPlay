import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getUserFromRequest } from './lib/auth.js';
import { createScanPlayCheckoutSession, ensureScanPlayProductLabel } from './lib/scanplayBranding.js';
import { getActivePaidSubscription, syncUserSubscriptionFromStripe } from './lib/subscriptionSync.js';
import { getAppUrl, getPriceId, getStripe, type BillingCycle, type PaidPlan } from './lib/stripe.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'unauthorized' });

    const body = (req.body ?? {}) as { plan?: string; billingCycle?: string };
    const plan = body.plan as PaidPlan | undefined;
    const billingCycle = body.billingCycle as BillingCycle | undefined;

    if (plan !== 'plus' && plan !== 'pro') {
      return res.status(400).json({ error: 'invalid_plan' });
    }
    if (billingCycle !== 'monthly' && billingCycle !== 'annual') {
      return res.status(400).json({ error: 'invalid_billing' });
    }

    const priceId = getPriceId(plan, billingCycle);
    if (!priceId) {
      return res.status(503).json({ error: 'stripe_not_configured' });
    }

    try {
      const active = await getActivePaidSubscription(user.id);
      if (active) {
        if (active.plan === plan) {
          const subscription = await syncUserSubscriptionFromStripe(user.id);
          return res.status(400).json({ error: 'already_subscribed', subscription });
        }
        return res.status(400).json({ error: 'upgrade_after_period_end' });
      }
    } catch (err) {
      console.warn('create-checkout-session: active subscription check skipped', err);
    }

    const stripe = getStripe();
    const appUrl = getAppUrl();

    try {
      await ensureScanPlayProductLabel(stripe, priceId, plan);
    } catch (err) {
      console.warn('create-checkout-session: product label sync skipped', err);
    }

    const session = await createScanPlayCheckoutSession(stripe, {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      payment_method_types: ['card'],
      success_url: `${appUrl}/?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?stripe=cancel`,
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: {
        user_id: user.id,
        plan,
        billing_cycle: billingCycle,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
          billing_cycle: billingCycle,
        },
      },
    }, appUrl);

    if (!session.url) {
      return res.status(500).json({ error: 'checkout_url_missing' });
    }

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session', err);
    if (err instanceof Stripe.errors.StripeError) {
      return res.status(400).json({
        error: 'stripe_checkout_failed',
        detail: err.message,
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('STRIPE_SECRET_KEY')) {
      return res.status(503).json({ error: 'stripe_not_configured' });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
}
