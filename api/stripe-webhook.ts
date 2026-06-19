import type { VercelRequest, VercelResponse } from '@vercel/node';
import type Stripe from 'stripe';
import { getSupabaseAdmin } from './lib/auth.js';
import { getStripe } from './lib/stripe.js';
import { subscriptionToProfileFields, upsertUserSubscription } from './lib/subscriptionSync.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function resolveUserId(
  metadata: Stripe.Metadata | null | undefined,
  clientReferenceId?: string | null,
): Promise<string | null> {
  if (metadata?.user_id) return metadata.user_id;
  if (clientReferenceId) return clientReferenceId;
  return null;
}

async function resolveUserIdFromCustomer(customerId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('scanplay_profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

async function setUserPlanFromSubscription(
  userId: string,
  subscription: Stripe.Subscription,
  customerId: string,
) {
  const fields = subscriptionToProfileFields(subscription, customerId);
  await upsertUserSubscription(userId, fields);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(503).send('Webhook not configured');
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    return res.status(400).send('Missing stripe-signature');
  }

  let event: Stripe.Event;
  try {
    const rawBody = await readRawBody(req);
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('stripe-webhook signature', err);
    return res.status(400).send('Invalid signature');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id;

        if (!subscriptionId || !customerId) break;

        let userId = await resolveUserId(session.metadata, session.client_reference_id);
        if (!userId) userId = await resolveUserIdFromCustomer(customerId);
        if (!userId) {
          console.warn('stripe-webhook: checkout.session.completed — no user_id', {
            customerId,
            subscriptionId,
            client_reference_id: session.client_reference_id,
          });
          break;
        }

        const stripe = getStripe();
        try {
          await stripe.customers.update(customerId, {
            metadata: { user_id: userId },
          });
        } catch (err) {
          console.warn('stripe-webhook: customer metadata update skipped', err);
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        let fields = subscriptionToProfileFields(subscription, customerId);
        const sessionPlan = session.metadata?.plan;
        if (fields.plan === 'free' && (sessionPlan === 'plus' || sessionPlan === 'pro')) {
          fields = {
            ...fields,
            plan: sessionPlan,
            billing_cycle:
              session.metadata?.billing_cycle === 'monthly' || session.metadata?.billing_cycle === 'annual'
                ? session.metadata.billing_cycle
                : fields.billing_cycle,
          };
        }
        await upsertUserSubscription(userId, fields);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;

        if (!customerId) break;

        let userId = await resolveUserId(subscription.metadata);
        if (!userId) userId = await resolveUserIdFromCustomer(customerId);
        if (!userId) break;

        await setUserPlanFromSubscription(userId, subscription, customerId);
        break;
      }
      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe-webhook handler', event.type, err);
    return res.status(500).send('Webhook handler failed');
  }
}
