-- Install PWA : date d’install + relance email J+14.
-- Exécuter dans Supabase → SQL Editor.

alter table public.scanplay_profiles
  add column if not exists pwa_installed_at timestamptz;

comment on column public.scanplay_profiles.pwa_installed_at is
  'Renseigné quand l’app est ouverte en mode installé (PWA). Relance email J+14 si null.';
