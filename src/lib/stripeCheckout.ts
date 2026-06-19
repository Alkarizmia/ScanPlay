import type { BillingCycle, Locale, Plan } from '../types';
import { waitForAuth } from './auth';
import { setBillingCycle, setPlan } from './planLimits';
import { applySubscriptionMeta } from './subscription';
import { getSupabase } from './supabase';

function parseEnvFlag(value: string | undefined): boolean | null {
  if (value == null || value.trim() === '') return null;
  const v = value.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return null;
}

export function isStripeCheckoutEnabled(): boolean {
  const fromEnv = parseEnvFlag(import.meta.env.VITE_STRIPE_CHECKOUT);
  if (fromEnv != null) return fromEnv;

  if (import.meta.env.PROD && typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (
      host === 'scanplay.org' ||
      host === 'www.scanplay.org' ||
      host.endsWith('.vercel.app')
    ) {
      return true;
    }
  }

  return false;
}

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function getAccessTokenWithRetry(): Promise<string | null> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const token = await getAccessToken();
    if (token) return token;
    await sleep(350 * (attempt + 1));
  }
  return null;
}

async function postStripeApi<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const token = await getAccessTokenWithRetry();
  if (!token) throw new Error('not_logged_in');

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('portal_timeout');
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }

  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'stripe_api_error');
  }
  return data;
}

function redirectToStripe(url: string, sameTab = false): void {
  if (!sameTab) {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    if (standalone) {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (opened) return;
    }
  }

  window.location.assign(url);
}

export async function startStripeCheckout(plan: Exclude<Plan, 'free'>, billingCycle: BillingCycle): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('not_logged_in');

  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan, billingCycle }),
  });

  const data = (await res.json()) as {
    url?: string;
    error?: string;
    subscription?: SyncedSubscriptionPayload;
  };

  if (!res.ok) {
    if (data.subscription) applySyncedSubscription(data.subscription);
    throw new Error(data.error ?? 'stripe_api_error');
  }

  if (!data.url) throw new Error('stripe_api_error');
  sessionStorage.setItem('scanplay-checkout-pending', '1');
  redirectToStripe(data.url, true);
}

export async function openStripePortal(): Promise<void> {
  const { url } = await postStripeApi<{ url: string }>('/api/create-portal-session');
  if (!url) throw new Error('portal_url_missing');
  redirectToStripe(url);
}

export interface SyncedSubscriptionPayload {
  plan: 'free' | 'plus' | 'pro';
  billing_cycle: 'monthly' | 'annual' | null;
  subscription_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncStripeSubscription(sessionId?: string | null): Promise<SyncedSubscriptionPayload | null> {
  const body: Record<string, unknown> = {};
  if (sessionId) body.sessionId = sessionId;

  const maxAttempts = sessionId ? 12 : 4;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const data = await postStripeApi<{ subscription: SyncedSubscriptionPayload }>(
        '/api/sync-subscription',
        body,
      );
      if (
        sessionId &&
        data.subscription.plan === 'free' &&
        attempt < maxAttempts - 1
      ) {
        await sleep(Math.min(1200 * (attempt + 1), 5000));
        continue;
      }
      return data.subscription;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await sleep(sessionId ? Math.min(1200 * (attempt + 1), 5000) : 800 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

export async function cancelSubscriptionRenewal(): Promise<SyncedSubscriptionPayload> {
  const data = await postStripeApi<{ subscription: SyncedSubscriptionPayload }>(
    '/api/cancel-subscription-renewal',
  );
  return data.subscription;
}

/** Apply Stripe subscription payload to local plan state (UI + limits). */
export function applySyncedSubscription(sub: SyncedSubscriptionPayload): void {
  if (sub.plan === 'free' || sub.plan === 'plus' || sub.plan === 'pro') {
    setPlan(sub.plan);
  }
  if (sub.billing_cycle === 'monthly' || sub.billing_cycle === 'annual') {
    setBillingCycle(sub.billing_cycle);
  }
  applySubscriptionMeta(sub.subscription_period_end, sub.subscription_cancel_at_period_end);
}

export async function refreshPlanFromStripe(sessionId?: string | null): Promise<SyncedSubscriptionPayload | null> {
  if (!isStripeCheckoutEnabled()) return null;
  try {
    const sub = await syncStripeSubscription(sessionId);
    if (sub?.plan === 'plus' || sub?.plan === 'pro') {
      applySyncedSubscription(sub);
    }
    return sub;
  } catch {
    return null;
  }
}

/** Aggressive post-checkout sync — waits for auth and retries until Plus/Pro is active. */
export async function activatePlanAfterCheckout(sessionId: string): Promise<SyncedSubscriptionPayload | null> {
  if (!isStripeCheckoutEnabled()) return null;
  await waitForAuth();
  try {
    const sub = await syncStripeSubscription(sessionId);
    if (sub?.plan === 'plus' || sub?.plan === 'pro') {
      applySyncedSubscription(sub);
      sessionStorage.removeItem('scanplay-checkout-pending');
      return sub;
    }
    return sub;
  } catch {
    return null;
  }
}

export function hasPendingCheckout(): boolean {
  return sessionStorage.getItem('scanplay-checkout-pending') === '1';
}

export function clearPendingCheckout(): void {
  sessionStorage.removeItem('scanplay-checkout-pending');
}

export function stripeErrorMessage(code: string, locale: Locale = 'fr'): string {
  const fr: Record<string, string> = {
    not_logged_in: 'Connecte-toi pour t\'abonner.',
    unauthorized: 'Session expirée. Reconnecte-toi.',
    stripe_not_configured: 'Paiement pas encore activé. Réessaie plus tard.',
    no_stripe_customer: 'Aucun abonnement Stripe trouvé pour ce compte.',
    invalid_plan: 'Plan invalide.',
    stripe_api_error: 'Erreur de paiement. Réessaie.',
    already_subscribed: 'Tu as déjà cet abonnement actif.',
    upgrade_after_period_end:
      'Tu ne peux pas changer de plan avant la fin de ta période en cours. Annule le renouvellement, attends la date de fin, puis souscris au nouveau plan.',
    no_active_subscription: 'Aucun abonnement actif à annuler.',
    stripe_checkout_failed: 'Impossible d\'ouvrir le paiement Stripe. Réessaie ou contacte support@scanplay.org.',
    internal_error:
      'Erreur serveur au paiement. Vérifie que tu es connecté, réessaie, ou écris à support@scanplay.org.',
    portal_timeout: 'Le portail Stripe met trop de temps à répondre. Réessaie.',
    portal_url_missing: 'Impossible d\'ouvrir le portail Stripe. Réessaie.',
    portal_blocked: 'Ouvre scanplay.org dans Chrome ou Safari, puis réessaie.',
    supabase_not_configured:
      'Configuration serveur incomplète. Ajoute SUPABASE_SERVICE_ROLE_KEY dans Vercel (Supabase → Settings → API).',
  };
  const en: Record<string, string> = {
    not_logged_in: 'Sign in to subscribe.',
    unauthorized: 'Session expired. Sign in again.',
    stripe_not_configured: 'Checkout is not enabled yet.',
    no_stripe_customer: 'No Stripe subscription found for this account.',
    invalid_plan: 'Invalid plan.',
    stripe_api_error: 'Payment error. Try again.',
    already_subscribed: 'You already have this active plan.',
    upgrade_after_period_end:
      'You cannot change plans before your current period ends. Cancel renewal, wait until it ends, then subscribe to the new plan.',
    no_active_subscription: 'No active subscription to cancel.',
    stripe_checkout_failed: 'Could not open Stripe checkout. Try again or contact support@scanplay.org.',
    internal_error: 'Server error during checkout. Sign in again or contact support@scanplay.org.',
    portal_timeout: 'Stripe portal is taking too long. Try again.',
    portal_url_missing: 'Could not open the Stripe portal. Try again.',
    portal_blocked: 'Open scanplay.org in Chrome or Safari, then try again.',
    supabase_not_configured:
      'Server config incomplete. Add SUPABASE_SERVICE_ROLE_KEY in Vercel (Supabase → Settings → API).',
  };
  return (locale === 'en' ? en : fr)[code] ?? code;
}
