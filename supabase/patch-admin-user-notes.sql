-- ============================================================
-- ScanPlay — Notes admin par utilisateur (CRM interne)
-- Exécuter dans Supabase → SQL Editor → Run
-- ============================================================

create table if not exists public.scanplay_admin_user_notes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

comment on table public.scanplay_admin_user_notes is
  'Notes internes admin (ex. pas revenu car 1er scan = 2 notions). Accès service_role only.';

alter table public.scanplay_admin_user_notes enable row level security;

-- Pas de policy pour authenticated : lecture/écriture via service_role (admin-metrics) uniquement.
