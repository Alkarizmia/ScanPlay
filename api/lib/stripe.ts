import Stripe from 'stripe';

export type PaidPlan = 'plus' | 'pro';
export type BillingCycle = 'monthly' | 'annual';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:5173';
}

export function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
}

export function getSupabaseAnonKey(): string {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
}

export function getPriceId(plan: PaidPlan, cycle: BillingCycle): string | null {
  const map: Record<string, string | undefined> = {
    'plus:monthly': process.env.STRIPE_PRICE_PLUS_MONTHLY,
    'plus:annual': process.env.STRIPE_PRICE_PLUS_ANNUAL,
    'pro:monthly': process.env.STRIPE_PRICE_PRO_MONTHLY,
    'pro:annual': process.env.STRIPE_PRICE_PRO_ANNUAL,
  };
  return map[`${plan}:${cycle}`] ?? null;
}

export function planFromPriceId(priceId: string | null | undefined): PaidPlan | 'free' {
  if (!priceId) return 'free';
  const plusIds = [process.env.STRIPE_PRICE_PLUS_MONTHLY, process.env.STRIPE_PRICE_PLUS_ANNUAL];
  const proIds = [process.env.STRIPE_PRICE_PRO_MONTHLY, process.env.STRIPE_PRICE_PRO_ANNUAL];
  if (plusIds.includes(priceId)) return 'plus';
  if (proIds.includes(priceId)) return 'pro';
  return 'free';
}

export function billingFromPriceId(priceId: string | null | undefined): BillingCycle | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PLUS_ANNUAL || priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) {
    return 'annual';
  }
  if (priceId === process.env.STRIPE_PRICE_PLUS_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) {
    return 'monthly';
  }
  return null;
}
