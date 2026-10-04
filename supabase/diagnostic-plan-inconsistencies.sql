-- ============================================================
-- ScanPlay — Comptes à risque pour mauvais scans (peu de cartes)
-- Supabase → SQL Editor → Run
--
-- Objectif : lister les comptes à AVERTIR (hard refresh / re-scan),
-- PAS supprimer.
--
-- Signal principal : decks cloud avec très peu de paires (ex. 1–7),
-- typique d’un scan IA raté / vieux client / OCR maigre —
-- comme le Free à 3 cartes vs un autre Free à 25 sur la même photo.
--
-- Ce n’est PAS une preuve à 100 % (une vraie mini-fiche peut avoir
-- 3 mots). Traite la liste comme prioritaire pour un message / push.
-- ============================================================


-- ------------------------------------------------------------
-- A) LISTE PRIORITAIRE À AVERTIR
--    Utilisateurs avec au moins 1 deck “maigre” (<= 7 cartes)
--    et/ou une moyenne basse sur leurs decks récents.
-- ------------------------------------------------------------
with deck_sizes as (
  select
    d.user_id,
    d.id as deck_id,
    d.title,
    d.created_at as deck_created_at,
    jsonb_array_length(coalesce(d.pairs, '[]'::jsonb)) as pair_count
  from public.scanplay_decks d
),
per_user as (
  select
    user_id,
    count(*)::int as deck_count,
    count(*) filter (where pair_count <= 7)::int as thin_deck_count,
    count(*) filter (where pair_count <= 3)::int as very_thin_deck_count,
    count(*) filter (where pair_count >= 20)::int as healthy_deck_count,
    round(avg(pair_count)::numeric, 1) as avg_pairs,
    max(pair_count) as max_pairs,
    min(pair_count) as min_pairs,
    max(deck_created_at) as last_deck_at,
    (array_agg(title order by pair_count asc, deck_created_at desc))[1] as thinnest_title,
    min(pair_count) filter (where true) as thinnest_pairs
  from deck_sizes
  group by user_id
)
select
  u.email,
  pp.display_name,
  coalesce(p.plan, 'no_profile') as plan,
  u.created_at as signed_up_at,
  u.last_sign_in_at,
  pu.deck_count,
  pu.thin_deck_count,
  pu.very_thin_deck_count,
  pu.healthy_deck_count,
  pu.avg_pairs,
  pu.min_pairs,
  pu.max_pairs,
  pu.thinnest_title,
  pu.last_deck_at,
  case
    when pu.very_thin_deck_count >= 1 and pu.healthy_deck_count = 0
      then 'warn_high'          -- que des scans maigres, aucun deck “plein”
    when pu.thin_deck_count >= 2
      then 'warn_high'          -- plusieurs decks ≤ 7 cartes
    when pu.avg_pairs <= 8 and pu.deck_count >= 1
      then 'warn_medium'        -- moyenne basse
    when pu.thin_deck_count = 1 and pu.healthy_deck_count >= 1
      then 'warn_low'           -- 1 echec isolé, d’autres scans OK
    else 'watch'
  end as warn_level,
  case
    when u.created_at < timestamptz '2026-06-15'
      then 'early_signup'       -- plus susceptibles d’avoir une vieille PWA
    else 'later_signup'
  end as cohort
from per_user pu
join auth.users u on u.id = pu.user_id
left join public.scanplay_profiles p on p.user_id = pu.user_id
left join public.scanplay_public_profiles pp on pp.user_id = pu.user_id
where
  pu.thin_deck_count >= 1
  or pu.avg_pairs <= 8
order by
  case
    when pu.very_thin_deck_count >= 1 and pu.healthy_deck_count = 0 then 0
    when pu.thin_deck_count >= 2 then 1
    when pu.avg_pairs <= 8 then 2
    else 3
  end,
  pu.last_deck_at desc nulls last;


-- ------------------------------------------------------------
-- B) DÉTAIL : les decks maigres (pour vérifier avant d’écrire)
-- ------------------------------------------------------------
select
  u.email,
  pp.display_name,
  coalesce(p.plan, 'no_profile') as plan,
  d.title,
  jsonb_array_length(coalesce(d.pairs, '[]'::jsonb)) as pair_count,
  d.created_at as scanned_at,
  left(coalesce(d.pairs -> 0 ->> 'term', ''), 40) as sample_term,
  left(coalesce(d.pairs -> 0 ->> 'definition', ''), 40) as sample_def
from public.scanplay_decks d
join auth.users u on u.id = d.user_id
left join public.scanplay_profiles p on p.user_id = d.user_id
left join public.scanplay_public_profiles pp on pp.user_id = d.user_id
where jsonb_array_length(coalesce(d.pairs, '[]'::jsonb)) <= 7
order by d.created_at desc
limit 200;


-- ------------------------------------------------------------
-- C) EARLY FREE sans aucun deck “plein” (>= 20) — cohort sœur
-- ------------------------------------------------------------
with deck_sizes as (
  select
    d.user_id,
    jsonb_array_length(coalesce(d.pairs, '[]'::jsonb)) as pair_count
  from public.scanplay_decks d
),
agg as (
  select
    user_id,
    count(*)::int as deck_count,
    count(*) filter (where pair_count <= 7)::int as thin_deck_count,
    count(*) filter (where pair_count >= 20)::int as healthy_deck_count,
    round(avg(pair_count)::numeric, 1) as avg_pairs
  from deck_sizes
  group by user_id
)
select
  u.email,
  pp.display_name,
  coalesce(p.plan, 'free') as plan,
  u.created_at as signed_up_at,
  u.last_sign_in_at,
  a.deck_count,
  a.thin_deck_count,
  a.healthy_deck_count,
  a.avg_pairs
from auth.users u
join agg a on a.user_id = u.id
left join public.scanplay_profiles p on p.user_id = u.id
left join public.scanplay_public_profiles pp on pp.user_id = u.id
where u.created_at < timestamptz '2026-06-15'
  and coalesce(p.plan, 'free') = 'free'
  and a.healthy_deck_count = 0
  and a.thin_deck_count >= 1
order by u.created_at;


-- ------------------------------------------------------------
-- D) Emails prêts à copier (warn_high seulement)
-- ------------------------------------------------------------
with deck_sizes as (
  select
    d.user_id,
    jsonb_array_length(coalesce(d.pairs, '[]'::jsonb)) as pair_count
  from public.scanplay_decks d
),
per_user as (
  select
    user_id,
    count(*) filter (where pair_count <= 7)::int as thin_deck_count,
    count(*) filter (where pair_count <= 3)::int as very_thin_deck_count,
    count(*) filter (where pair_count >= 20)::int as healthy_deck_count,
    round(avg(pair_count)::numeric, 1) as avg_pairs
  from deck_sizes
  group by user_id
)
select string_agg(u.email, ', ' order by u.email) as emails_warn_high
from per_user pu
join auth.users u on u.id = pu.user_id
where
  (pu.very_thin_deck_count >= 1 and pu.healthy_deck_count = 0)
  or pu.thin_deck_count >= 2
  or (pu.avg_pairs <= 8 and pu.thin_deck_count >= 1);


-- ------------------------------------------------------------
-- E) (Optionnel) Pro/Plus manuel sans Stripe — autre sujet
-- ------------------------------------------------------------
select
  u.email,
  pp.display_name,
  p.plan,
  'paid_plan_without_stripe' as issue
from public.scanplay_profiles p
join auth.users u on u.id = p.user_id
left join public.scanplay_public_profiles pp on pp.user_id = p.user_id
where p.plan in ('plus', 'pro')
  and p.stripe_subscription_id is null
  and p.stripe_customer_id is null
order by p.updated_at desc;
