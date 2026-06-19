import type Stripe from 'stripe';
import { getSupabaseAdmin } from './auth.js';
import { billingFromPriceId, getStripe, planFromPriceId, type BillingCycle, type PaidPlan } from './stripe.js';

export interface SyncedSubscription {
  plan: 'free' | 'plus' | 'pro';
  billing_cycle: 'monthly' | 'annual' | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
}

function customerIdFrom(subscription: Stripe.Subscription): string | null {
  return typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id ?? null;
}

function billingFromSubscription(
  subscription: Stripe.Subscription,
  priceId: string | null,
  active: boolean,
): BillingCycle | null {
  if (!active) return null;
  const fromPrice = billingFromPriceId(priceId);
  if (fromPrice) return fromPrice;
  const meta = subscription.metadata?.billing_cycle;
  if (meta === 'monthly' || meta === 'annual') return meta;
  return null;
}

function isScanPlaySubscription(sub: Stripe.Subscription, userId?: string): boolean {
  if (sub.status !== 'active' && sub.status !== 'trialing') return false;

  const priceId = sub.items.data[0]?.price?.id ?? null;
  if (planFromPriceId(priceId) !== 'free') return true;

  const metaPlan = sub.metadata?.plan;
  if (metaPlan === 'plus' || metaPlan === 'pro') return true;

  if (userId && sub.metadata?.user_id === userId) return true;

  return false;
}

function profileFieldsFromRow(
  profile: Record<string, unknown>,
): SyncedSubscription {
  const plan = profile.plan;
  return {
    plan: plan === 'plus' || plan === 'pro' ? plan : 'free',
    billing_cycle:
      profile.billing_cycle === 'monthly' || profile.billing_cycle === 'annual'
        ? profile.billing_cycle
        : null,
    stripe_customer_id: (profile.stripe_customer_id as string | null) ?? null,
    stripe_subscription_id: (profile.stripe_subscription_id as string | null) ?? null,
    stripe_price_id: (profile.stripe_price_id as string | null) ?? null,
    subscription_period_end: (profile.subscription_period_end as string | null) ?? null,
    subscription_cancel_at_period_end: Boolean(profile.subscription_cancel_at_period_end),
  };
}

function resolvePlan(subscription: Stripe.Subscription, priceId: string | null, active: boolean): 'free' | 'plus' | 'pro' {
  if (!active) return 'free';

  let plan = planFromPriceId(priceId);
  if (plan === 'free') {
    const metaPlan = subscription.metadata?.plan;
    if (metaPlan === 'plus' || metaPlan === 'pro') plan = metaPlan;
  }
  return plan === 'free' ? 'free' : plan;
}

export function subscriptionToProfileFields(
  subscription: Stripe.Subscription,
  customerId: string,
): SyncedSubscription {
  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;
  const status = subscription.status;
  const active = status === 'active' || status === 'trialing';
  const plan = resolvePlan(subscription, priceId, active);
  const billing = billingFromSubscription(subscription, priceId, active);
  const periodEndUnix = item?.current_period_end;
  const periodEnd =
    active && periodEndUnix
      ? new Date(periodEndUnix * 1000).toISOString()
      : null;

  return {
    plan,
    billing_cycle: billing,
    stripe_customer_id: customerId,
    stripe_subscription_id: active ? subscription.id : null,
    stripe_price_id: active ? priceId : null,
    subscription_period_end: periodEnd,
    subscription_cancel_at_period_end: active ? Boolean(subscription.cancel_at_period_end) : false,
  };
}

export async function upsertUserSubscription(userId: string, fields: SyncedSubscription): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload = {
    plan: fields.plan,
    stripe_customer_id: fields.stripe_customer_id,
    stripe_subscription_id: fields.stripe_subscription_id,
    stripe_price_id: fields.stripe_price_id,
    billing_cycle: fields.billing_cycle,
    subscription_period_end: fields.subscription_period_end,
    subscription_cancel_at_period_end: fields.subscription_cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: readError } = await supabase
    .from('scanplay_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (readError) throw readError;

  if (existing) {
    const { error } = await supabase.from('scanplay_profiles').update(payload).eq('user_id', userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('scanplay_profiles').insert({
    user_id: userId,
    xp: 0,
    streak: 0,
    locale: 'fr',
    ...payload,
  });
  if (error) throw error;
}

async function findActiveSubscription(
  stripe: Stripe,
  userId: string,
  customerId?: string | null,
  subscriptionId?: string | null,
  userEmail?: string | null,
): Promise<Stripe.Subscription | null> {
  const match = (sub: Stripe.Subscription) => isScanPlaySubscription(sub, userId);

  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      if (match(sub)) return sub;
      const sessionPlan = sub.metadata?.plan;
      if (
        (sub.status === 'active' || sub.status === 'trialing') &&
        (sessionPlan === 'plus' || sessionPlan === 'pro')
      ) {
        return sub;
      }
    } catch {
      /* try other methods */
    }
  }

  if (customerId) {
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 20,
    });
    const active = subs.data.find(match);
    if (active) return active;
  }

  try {
    const result = await stripe.subscriptions.search({
      query: `metadata['user_id']:'${userId}'`,
      limit: 10,
    });
    const active = result.data.find(match);
    if (active) return active;
  } catch {
    /* Stripe Search optional */
  }

  if (userEmail) {
    const customers = await stripe.customers.list({ email: userEmail, limit: 10 });
    for (const customer of customers.data) {
      if (customer.metadata?.user_id && customer.metadata.user_id !== userId) continue;
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 20,
      });
      const active = subs.data.find(match);
      if (active) return active;
    }
  }

  return null;
}

export async function syncUserSubscriptionFromStripe(
  userId: string,
  sessionId?: string | null,
  userEmail?: string | null,
): Promise<SyncedSubscription | null> {
  const stripe = getStripe();
  const supabase = getSupabaseAdmin();

  if (sessionId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
    if (session.mode !== 'subscription') return null;

    const sessionUserId = session.metadata?.user_id ?? session.client_reference_id;
    if (sessionUserId && sessionUserId !== userId) return null;

    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;

    if (!subscriptionId || !customerId) return null;

    try {
      await stripe.customers.update(customerId, {
        metadata: { user_id: userId },
      });
    } catch (err) {
      console.warn('syncUserSubscriptionFromStripe: customer metadata update skipped', err);
    }

    const subscription =
      typeof session.subscription === 'object' && session.subscription
        ? session.subscription
        : await stripe.subscriptions.retrieve(subscriptionId);

    let fields = subscriptionToProfileFields(subscription, customerId);

    const sessionPlan = session.metadata?.plan;
    const sessionBilling = session.metadata?.billing_cycle;
    const paid =
      session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
    if (
      paid &&
      (sessionPlan === 'plus' || sessionPlan === 'pro') &&
      fields.plan === 'free'
    ) {
      fields = {
        ...fields,
        plan: sessionPlan,
        billing_cycle:
          sessionBilling === 'monthly' || sessionBilling === 'annual'
            ? sessionBilling
            : fields.billing_cycle,
        stripe_subscription_id: subscription.id,
        stripe_price_id: subscription.items.data[0]?.price?.id ?? fields.stripe_price_id,
        subscription_period_end:
          fields.subscription_period_end ??
          (subscription.items.data[0]?.current_period_end
            ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
            : null),
      };
    }

    await upsertUserSubscription(userId, fields);
    return fields;
  }

  const { data: profile } = await supabase
    .from('scanplay_profiles')
    .select(
      'plan, billing_cycle, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_period_end, subscription_cancel_at_period_end',
    )
    .eq('user_id', userId)
    .maybeSingle();

  const subscription = await findActiveSubscription(
    stripe,
    userId,
    profile?.stripe_customer_id,
    profile?.stripe_subscription_id,
    userEmail,
  );

  if (!subscription) {
    if (profile && (profile.plan === 'plus' || profile.plan === 'pro')) {
      return profileFieldsFromRow(profile);
    }

    return {
      plan: 'free',
      billing_cycle: null,
      stripe_customer_id: profile?.stripe_customer_id ?? null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      subscription_period_end: null,
      subscription_cancel_at_period_end: false,
    };
  }

  const customerId = customerIdFrom(subscription);
  if (!customerId) return null;

  const fields = subscriptionToProfileFields(subscription, customerId);
  await upsertUserSubscription(userId, fields);
  return fields;
}

export async function getActivePaidSubscription(
  userId: string,
): Promise<{ subscription: Stripe.Subscription; plan: PaidPlan } | null> {
  const stripe = getStripe();
  let customerId: string | null = null;
  let subscriptionId: string | null = null;

  try {
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from('scanplay_profiles')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', userId)
      .maybeSingle();
    customerId = profile?.stripe_customer_id ?? null;
    subscriptionId = profile?.stripe_subscription_id ?? null;
  } catch (err) {
    console.warn('getActivePaidSubscription: profile lookup skipped', err);
  }

  const subscription = await findActiveSubscription(
    stripe,
    userId,
    customerId,
    subscriptionId,
  );
  if (!subscription) return null;

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const plan = resolvePlan(subscription, priceId, true);
  if (plan !== 'plus' && plan !== 'pro') return null;

  return { subscription, plan };
}

/** Ensure a Stripe customer belongs to this Supabase user (never open another account's portal). */
export async function verifyStripeCustomerForUser(
  stripe: Stripe,
  customerId: string,
  userId: string,
): Promise<boolean> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ('deleted' in customer && customer.deleted) return false;
    const metaUid = 'metadata' in customer ? customer.metadata?.user_id : undefined;
    if (metaUid) return metaUid === userId;
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 20,
    });
    return subs.data.some(
      (sub) =>
        sub.metadata?.user_id === userId &&
        (sub.status === 'active' || sub.status === 'trialing'),
    );
  } catch {
    return false;
  }
}

/** Find Stripe customer id from DB, active subscription, or email/metadata. */
export async function resolveStripeCustomerId(
  userId: string,
  email?: string | null,
): Promise<string | null> {
  const stripe = getStripe();
  let profileCustomerId: string | null = null;
  let profileSubscriptionId: string | null = null;

  try {
    const { tryGetSupabaseAdmin } = await import('./auth.js');
    const supabase = tryGetSupabaseAdmin();
    if (supabase) {
      const { data: profile } = await supabase
        .from('scanplay_profiles')
        .select('stripe_customer_id, stripe_subscription_id')
        .eq('user_id', userId)
        .maybeSingle();
      profileCustomerId = profile?.stripe_customer_id ?? null;
      profileSubscriptionId = profile?.stripe_subscription_id ?? null;
      if (
        profileCustomerId &&
        (await verifyStripeCustomerForUser(stripe, profileCustomerId, userId))
      ) {
        return profileCustomerId;
      }
      profileCustomerId = null;
    }
  } catch (err) {
    console.warn('resolveStripeCustomerId: profile lookup skipped', err);
  }

  const subscription = await findActiveSubscription(
    stripe,
    userId,
    profileCustomerId,
    profileSubscriptionId,
  );
  const fromSub = subscription ? customerIdFrom(subscription) : null;
  if (fromSub && (await verifyStripeCustomerForUser(stripe, fromSub, userId))) {
    return fromSub;
  }

  if (email) {
    const customers = await stripe.customers.list({ email, limit: 10 });
    const match = customers.data.find((c) => c.metadata?.user_id === userId);
    if (match?.id && (await verifyStripeCustomerForUser(stripe, match.id, userId))) {
      return match.id;
    }
  }

  try {
    const result = await stripe.customers.search({
      query: `metadata['user_id']:'${userId}'`,
      limit: 1,
    });
    const found = result.data[0]?.id;
    if (found && (await verifyStripeCustomerForUser(stripe, found, userId))) {
      return found;
    }
  } catch {
    /* Stripe Search optional */
  }

  return null;
}

export async function cancelSubscriptionRenewal(userId: string): Promise<SyncedSubscription | null> {
  const active = await getActivePaidSubscription(userId);
  if (!active) return null;

  const stripe = getStripe();
  const updated = await stripe.subscriptions.update(active.subscription.id, {
    cancel_at_period_end: true,
  });

  const customerId = customerIdFrom(updated);
  if (!customerId) return null;

  const fields = subscriptionToProfileFields(updated, customerId);
  await upsertUserSubscription(userId, fields);
  return fields;
}
