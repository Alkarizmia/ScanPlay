-- ============================================================
-- ScanPlay — ABONNEMENTS STRIPE (script complet)
-- Exécuter dans Supabase → SQL Editor → Run
--
-- Corrige : plan bloqué sur "free" après paiement Stripe
-- Prérequis Vercel : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
--   SUPABASE_SERVICE_ROLE_KEY, STRIPE_PRICE_PLUS_*, STRIPE_PRICE_PRO_*
-- ============================================================


-- 1. Colonnes Stripe sur scanplay_profiles
-- ------------------------------------------------------------

alter table public.scanplay_profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists billing_cycle text,
  add column if not exists subscription_period_end timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean not null default false;

-- Contrainte billing_cycle (ignore si déjà là)
do $$
begin
  alter table public.scanplay_profiles
    add constraint scanplay_profiles_billing_cycle_check
    check (billing_cycle is null or billing_cycle in ('monthly', 'annual'));
exception
  when duplicate_object then null;
end $$;

-- Plan doit rester free | plus | pro
do $$
begin
  alter table public.scanplay_profiles
    add constraint scanplay_profiles_plan_check
    check (plan in ('free', 'plus', 'pro'));
exception
  when duplicate_object then null;
end $$;

create unique index if not exists scanplay_profiles_stripe_subscription_id_idx
  on public.scanplay_profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists scanplay_profiles_stripe_customer_id_idx
  on public.scanplay_profiles (stripe_customer_id)
  where stripe_customer_id is not null;


-- 2. Colonnes sync série (si pas encore fait)
-- ------------------------------------------------------------

alter table public.scanplay_profiles
  add column if not exists streak_lost_value int not null default 0,
  add column if not exists streak_lost_at bigint,
  add column if not exists streak_lost_ack_at bigint;


-- 3. Vérifier ton profil (remplace l'email)
-- ------------------------------------------------------------

select
  u.id as user_id,
  u.email,
  p.plan,
  p.billing_cycle,
  p.stripe_customer_id,
  p.stripe_subscription_id,
  p.stripe_price_id,
  p.subscription_period_end,
  p.subscription_cancel_at_period_end,
  p.updated_at
from auth.users u
left join public.scanplay_profiles p on p.user_id = u.id
where u.email = 'TON_EMAIL@example.com';


-- 4. Correction manuelle immédiate (après paiement Pro validé)
--    Remplace l'email. Les IDs Stripe sont optionnels mais recommandés.
-- ------------------------------------------------------------

/*
update public.scanplay_profiles p
set
  plan = 'pro',
  billing_cycle = 'monthly',
  stripe_customer_id = 'cus_XXXXXXXXXXXX',
  stripe_subscription_id = 'sub_XXXXXXXXXXXX',
  stripe_price_id = 'price_XXXXXXXXXXXX',
  subscription_period_end = now() + interval '1 month',
  subscription_cancel_at_period_end = false,
  updated_at = now()
from auth.users u
where p.user_id = u.id
  and u.email = 'TON_EMAIL@example.com';
*/


-- 5. Forcer Pro pour TON compte (version simple sans IDs Stripe)
-- ------------------------------------------------------------

/*
update public.scanplay_profiles p
set
  plan = 'pro',
  billing_cycle = 'monthly',
  subscription_period_end = now() + interval '1 month',
  subscription_cancel_at_period_end = false,
  updated_at = now()
from auth.users u
where p.user_id = u.id
  and u.email = 'TON_EMAIL@example.com';
*/


-- 6. Créer le profil s'il manque (rare)
-- ------------------------------------------------------------

insert into public.scanplay_profiles (user_id, xp, streak, plan, locale)
select u.id, 0, 0, 'free', 'fr'
from auth.users u
where u.email = 'TON_EMAIL@example.com'
  and not exists (
    select 1 from public.scanplay_profiles p where p.user_id = u.id
  );


-- 7. Diagnostic : tous les profils payants
-- ------------------------------------------------------------

select
  u.email,
  p.plan,
  p.billing_cycle,
  p.stripe_subscription_id,
  p.subscription_period_end,
  p.updated_at
from public.scanplay_profiles p
join auth.users u on u.id = p.user_id
where p.plan in ('plus', 'pro')
order by p.updated_at desc;
