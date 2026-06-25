-- ============================================================
-- ScanPlay — TRANSFERT DONNÉES + USERS (ancien → nouveau Supabase)
--
-- Ce fichier ne s'exécute PAS dans le SQL Editor Supabase seul.
-- Il guide l'export/import via pg_dump / psql depuis ton PC.
--
-- Ordre obligatoire:
--   1. setup-complete-production.sql sur le NOUVEAU projet
--   2. Export auth.users depuis l'ANCIEN projet
--   3. Export tables public.scanplay_* depuis l'ANCIEN projet
--   4. Import sur le NOUVEAU projet (auth d'abord, puis public)
--   5. Mettre à jour Vercel + redeploy
--
-- Ancien projet ScanPlay prod : makskleablwrmzhtbejc
-- Nouveau projet (exemple)     : iitboqjmatcnjhaaznlh
-- ============================================================


-- ── ÉTAPE A — Où trouver le mot de passe DB ──
-- Supabase → Settings → Database → Database password
-- Connection string → URI (mode Session, port 5432)


-- ── ÉTAPE B — Export depuis l'ANCIEN (PowerShell / terminal) ──
--
-- Remplace [MDP] et [ANCIEN_REF] :

/*
pg_dump "postgresql://postgres.[ANCIEN_REF]:[MDP]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \
  --data-only \
  --schema=auth \
  --table=auth.users \
  --table=auth.identities \
  -f export-auth.sql

pg_dump "postgresql://postgres.[ANCIEN_REF]:[MDP]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \
  --data-only \
  --schema=public \
  --table=public.scanplay_profiles \
  --table=public.scanplay_decks \
  --table=public.scanplay_mistakes \
  --table=public.scanplay_user_stats \
  --table=public.scanplay_exam_history \
  --table=public.scanplay_public_profiles \
  --table=public.scanplay_friend_requests \
  --table=public.scanplay_social_notifications \
  --table=public.scanplay_follows \
  --table=public.scanplay_rooms \
  --table=public.scanplay_room_players \
  --table=public.scanplay_wallets \
  --table=public.scanplay_coin_transfers \
  -f export-data.sql
*/


-- ── ÉTAPE C — Import sur le NOUVEAU ──
--
/*
psql "postgresql://postgres.[NOUVEAU_REF]:[MDP]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \
  -f export-auth.sql

psql "postgresql://postgres.[NOUVEAU_REF]:[MDP]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \
  -f export-data.sql
*/


-- ── ÉTAPE D — Vérification (SQL Editor NOUVEAU projet) ──

select
  (select count(*) from auth.users) as users,
  (select count(*) from public.scanplay_profiles) as profiles,
  (select count(*) from public.scanplay_decks) as decks,
  (select count(*) from public.scanplay_wallets) as wallets;

select u.email, p.xp, p.streak, p.plan,
  (select count(*) from public.scanplay_decks d where d.user_id = u.id) as decks
from auth.users u
left join public.scanplay_profiles p on p.user_id = u.id
order by u.created_at desc
limit 20;


-- ── Notes ──
-- • Les mots de passe hashés dans auth.users sont conservés → même login qu'avant.
-- • auth.identities nécessaire si connexion Google OAuth.
-- • Après import : tous les users doivent avoir un profil (trigger ne rejoue pas sur import).
-- • Si profil manquant, lancer le backfill :

insert into public.scanplay_profiles (user_id, xp, streak, plan, locale)
select u.id, 0, 0, 'free', 'fr'
from auth.users u
where not exists (select 1 from public.scanplay_profiles p where p.user_id = u.id)
on conflict (user_id) do nothing;

insert into public.scanplay_user_stats (user_id, data)
select u.id, '{}'::jsonb
from auth.users u
where not exists (select 1 from public.scanplay_user_stats s where s.user_id = u.id)
on conflict (user_id) do nothing;

insert into public.scanplay_wallets (user_id, coins)
select u.id, 100
from auth.users u
where not exists (select 1 from public.scanplay_wallets w where w.user_id = u.id)
on conflict (user_id) do nothing;

insert into public.scanplay_public_profiles (user_id, display_name, avatar_id, level)
select u.id,
  'ID-' || lpad((abs(hashtext(replace(u.id::text, '-', ''))) % 10000)::text, 4, '0'),
  'avatar1',
  1
from auth.users u
where not exists (select 1 from public.scanplay_public_profiles p where p.user_id = u.id)
on conflict (user_id) do nothing;
