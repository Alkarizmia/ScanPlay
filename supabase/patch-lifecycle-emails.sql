-- Emails externes ScanPlay (série en danger, demandes d'amis).
-- Exécuter dans Supabase → SQL Editor.

alter table public.scanplay_profiles
  add column if not exists email_alerts boolean not null default true;

comment on column public.scanplay_profiles.email_alerts is
  'Emails ScanPlay (rappel série, amis). Aligné sur le toggle Notifications de l''app.';

create table if not exists public.scanplay_email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  dedupe_key text not null unique,
  sent_at timestamptz not null default now()
);

create index if not exists scanplay_email_log_user_kind_idx
  on public.scanplay_email_log (user_id, kind, sent_at desc);

alter table public.scanplay_email_log enable row level security;

grant all on public.scanplay_email_log to service_role;
