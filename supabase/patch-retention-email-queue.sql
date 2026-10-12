-- ScanPlay — file emails rétention + audit purge Free inactifs
-- Exécuter dans Supabase → SQL Editor (une fois).

-- 1) Statut sur le log emails (sent vs skipped_quota ; anciennes lignes = sent)
alter table public.scanplay_email_log
  add column if not exists status text not null default 'sent';

do $$
begin
  alter table public.scanplay_email_log
    add constraint scanplay_email_log_status_check
    check (status in ('sent', 'skipped_quota', 'dry_run'));
exception
  when duplicate_object then null;
end $$;

comment on column public.scanplay_email_log.status is
  'sent = email Resend OK ; skipped_quota = abandonné après reports ; dry_run = simulation';

-- 2) File d'attente priorisée (P2/P3 + préavis P1)
create table if not exists public.scanplay_email_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  dedupe_key text not null unique,
  priority int not null check (priority between 0 and 9),
  eligible_on date not null,
  deferred_days int not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'skipped_quota', 'cancelled')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scanplay_email_queue_pending_idx
  on public.scanplay_email_queue (status, priority, eligible_on)
  where status = 'pending';

create index if not exists scanplay_email_queue_user_idx
  on public.scanplay_email_queue (user_id, kind);

alter table public.scanplay_email_queue enable row level security;
grant all on public.scanplay_email_queue to service_role;

-- 3) Audit suppressions (pas de FK cascade : on garde la trace après delete user)
create table if not exists public.scanplay_account_purge_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text not null,
  plan text,
  last_sign_in_at timestamptz,
  warned_at timestamptz,
  deleted_at timestamptz,
  reason text not null,
  dry_run boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scanplay_account_purge_log_created_idx
  on public.scanplay_account_purge_log (created_at desc);

alter table public.scanplay_account_purge_log enable row level security;
grant all on public.scanplay_account_purge_log to service_role;
