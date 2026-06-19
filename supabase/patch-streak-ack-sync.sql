-- ScanPlay — synchro « série perdue » vue / dismissée (multi-appareils)
-- Supabase → SQL Editor → Run

alter table public.scanplay_profiles
  add column if not exists streak_lost_value int not null default 0,
  add column if not exists streak_lost_at bigint,
  add column if not exists streak_lost_ack_at bigint;

comment on column public.scanplay_profiles.streak_lost_value is 'Dernière série perdue (jours) — offre shop';
comment on column public.scanplay_profiles.streak_lost_at is 'Timestamp ms de la perte de série';
comment on column public.scanplay_profiles.streak_lost_ack_at is 'Timestamp ms quand l''utilisateur a fermé la modale';
