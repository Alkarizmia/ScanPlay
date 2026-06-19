-- ScanPlay — colonnes Stripe pour abonnements Plus / Pro
-- Exécuter dans Supabase → SQL Editor après avoir créé les produits Stripe

alter table public.scanplay_profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists billing_cycle text check (billing_cycle in ('monthly', 'annual')),
  add column if not exists subscription_period_end timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean not null default false;

create unique index if not exists scanplay_profiles_stripe_subscription_id_idx
  on public.scanplay_profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists scanplay_profiles_stripe_customer_id_idx
  on public.scanplay_profiles (stripe_customer_id)
  where stripe_customer_id is not null;
