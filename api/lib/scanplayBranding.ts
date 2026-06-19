import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Stripe from 'stripe';
import type { PaidPlan } from './stripe.js';

const SCANPLAY_GREEN = '#34C759';
const SCANPLAY_BG = '#0f172a';

let cachedIconFileId: string | null = process.env.STRIPE_SCANPLAY_ICON_FILE ?? null;

export function scanplayProductName(plan: PaidPlan): string {
  return plan === 'plus' ? 'ScanPlay Plus' : 'ScanPlay Pro';
}

function readBundledIcon(): Buffer {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/scanplay-checkout-icon.png');
  return readFileSync(path);
}

async function resolveScanPlayIconFile(stripe: Stripe, appUrl: string): Promise<string | null> {
  if (cachedIconFileId) return cachedIconFileId;
  if (process.env.STRIPE_SCANPLAY_ICON_FILE) {
    cachedIconFileId = process.env.STRIPE_SCANPLAY_ICON_FILE;
    return cachedIconFileId;
  }

  let buffer: Buffer | null = null;
  try {
    buffer = readBundledIcon();
  } catch {
    try {
      const res = await fetch(`${appUrl}/icon-512.png`);
      if (res.ok) buffer = Buffer.from(await res.arrayBuffer());
    } catch {
      /* use bundled icon only */
    }
  }

  if (!buffer) return null;

  try {
    const file = await stripe.files.create({
      purpose: 'business_icon',
      file: {
        data: buffer,
        name: 'scanplay-checkout-icon.png',
        type: 'image/png',
      },
    });
    cachedIconFileId = file.id;
    return file.id;
  } catch (err) {
    console.warn('scanplayBranding: Stripe icon upload skipped', err);
    return null;
  }
}

export async function buildScanPlayCheckoutBranding(
  stripe: Stripe,
  appUrl: string,
): Promise<Stripe.Checkout.SessionCreateParams.BrandingSettings> {
  const iconFile = await resolveScanPlayIconFile(stripe, appUrl);
  const branding: Stripe.Checkout.SessionCreateParams.BrandingSettings = {
    display_name: 'ScanPlay',
    button_color: SCANPLAY_GREEN,
    background_color: SCANPLAY_BG,
  };

  if (iconFile) {
    branding.icon = { type: 'file', file: iconFile };
  } else {
    branding.icon = { type: 'url', url: `${appUrl}/icon-512.png` };
  }

  return branding;
}

export async function ensureScanPlayProductLabel(
  stripe: Stripe,
  priceId: string,
  plan: PaidPlan,
): Promise<void> {
  const expected = scanplayProductName(plan);
  const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
  const raw = price.product;
  if (typeof raw === 'string' || ('deleted' in raw && raw.deleted)) return;

  const product = raw as Stripe.Product;
  if (product.name === expected) return;

  await stripe.products.update(product.id, {
    name: expected,
    metadata: {
      ...product.metadata,
      app: 'scanplay',
    },
  });
}

type SessionParams = Stripe.Checkout.SessionCreateParams;

export async function createScanPlayCheckoutSession(
  stripe: Stripe,
  params: SessionParams,
  appUrl: string,
): Promise<Stripe.Checkout.Session> {
  const branding = await buildScanPlayCheckoutBranding(stripe, appUrl);
  const withBranding: SessionParams = { ...params, branding_settings: branding };

  const attempts: SessionParams[] = [
    withBranding,
    {
      ...params,
      branding_settings: {
        display_name: 'ScanPlay',
        button_color: SCANPLAY_GREEN,
        background_color: SCANPLAY_BG,
      },
    },
    {
      ...params,
      branding_settings: { display_name: 'ScanPlay' },
    },
    params,
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await stripe.checkout.sessions.create(attempt);
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (!/branding|icon|logo|url|file/i.test(message)) throw err;
    }
  }

  throw lastError;
}

const portalConfigCache: { id: string | null } = { id: null };

/** Billing portal config branded for ScanPlay (shared Stripe account). */
export async function ensureScanPlayPortalConfiguration(
  stripe: Stripe,
  appUrl: string,
): Promise<string> {
  if (process.env.STRIPE_PORTAL_CONFIGURATION_ID) {
    return process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  }
  if (portalConfigCache.id) return portalConfigCache.id;

  const configs = await stripe.billingPortal.configurations.list({ limit: 20 });
  const existing = configs.data.find(
    (c) => c.metadata?.app === 'scanplay' || c.name === 'ScanPlay',
  );
  if (existing?.id) {
    portalConfigCache.id = existing.id;
    return existing.id;
  }

  const config = await stripe.billingPortal.configurations.create({
    name: 'ScanPlay',
    metadata: { app: 'scanplay' },
    default_return_url: `${appUrl}/?stripe=portal`,
    business_profile: {
      headline: 'ScanPlay — gère ton abonnement',
      privacy_policy_url: `${appUrl.replace(/\/$/, '')}/privacy.html`,
    },
    features: {
      customer_update: { enabled: true, allowed_updates: ['email', 'name'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: { enabled: false },
    },
  });

  portalConfigCache.id = config.id;
  return config.id;
}

export async function createScanPlayPortalSession(
  stripe: Stripe,
  customerId: string,
  appUrl: string,
): Promise<Stripe.BillingPortal.Session> {
  const returnUrl = `${appUrl}/?stripe=portal`;

  // Default portal first (same as PayPuls) — most reliable on shared Stripe accounts.
  try {
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  } catch (defaultErr) {
    console.warn('createScanPlayPortalSession: default portal failed', defaultErr);
  }

  try {
    const configuration = await ensureScanPlayPortalConfiguration(stripe, appUrl);
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration,
      return_url: returnUrl,
    });
  } catch (err) {
    console.error('createScanPlayPortalSession: ScanPlay portal failed', err);
    throw err;
  }
}
