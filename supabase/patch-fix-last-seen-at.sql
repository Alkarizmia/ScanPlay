-- ============================================================
-- Fix rapide — column last_seen_at missing
-- Si setup-complete-production.sql a échoué sur list_my_friends :
--   1. Run CE fichier
--   2. Puis run patch-friend-presence.sql → patch-friend-presence-fix.sql
--      (ou re-run setup-complete-production.sql entier après regénération)
-- ============================================================

alter table public.scanplay_public_profiles
  add column if not exists last_seen_at timestamptz;

comment on column public.scanplay_public_profiles.last_seen_at is
  'Dernière activité app (heartbeat). En ligne si < 5 min.';

-- Colonnes parfois manquantes si le script s'est arrêté avant la fin
alter table public.scanplay_public_profiles
  add column if not exists avatar_url text,
  add column if not exists achievement_unlocks jsonb not null default '[]'::jsonb,
  add column if not exists achievement_count int not null default 0,
  add column if not exists plan text not null default 'free';
