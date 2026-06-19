-- ============================================================
-- ScanPlay — ACTIVER l'authentification par EMAIL
-- Exécuter dans Supabase → SQL Editor → Run
--
-- ⚠️ AVANT d'exécuter ce SQL, configure le SMTP dans le Dashboard :
--    Authentication → SMTP Settings → Enable Custom SMTP
--    (voir EMAIL_AUTH_SETUP.md — Resend + support@scanplay.org)
--
-- Puis dans le Dashboard :
--    Authentication → Providers → Email → ACTIVER "Confirm email"
--    Authentication → URL Configuration
--      Site URL      : https://scanplay.org
--      Redirect URLs : https://scanplay.org/**
-- ============================================================


-- 1. TABLES SYNC (identique à sync-cloud-complete.sql)
-- ------------------------------------------------------------

create table if not exists public.scanplay_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp int not null default 0,
  streak int not null default 0,
  last_play_date date,
  plan text not null default 'free' check (plan in ('free', 'plus', 'pro')),
  locale text not null default 'fr',
  updated_at timestamptz not null default now()
);

create table if not exists public.scanplay_decks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  pairs jsonb not null default '[]'::jsonb,
  thumbnail text,
  last_mode text,
  step_progress jsonb,
  completed_steps int[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scanplay_decks_user_id_idx on public.scanplay_decks (user_id);
create index if not exists scanplay_decks_user_created_idx on public.scanplay_decks (user_id, created_at desc);

create table if not exists public.scanplay_mistakes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  term text not null,
  definition text not null,
  mode text not null,
  deck_id uuid,
  step_index int,
  corrected boolean not null default false,
  created_at timestamptz not null default now(),
  corrected_at timestamptz
);

create index if not exists scanplay_mistakes_user_id_idx on public.scanplay_mistakes (user_id);

create table if not exists public.scanplay_user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);


-- 2. PERMISSIONS + RLS
-- ------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;

alter table public.scanplay_profiles enable row level security;
alter table public.scanplay_decks enable row level security;
alter table public.scanplay_mistakes enable row level security;
alter table public.scanplay_user_stats enable row level security;

drop policy if exists "scanplay_profiles_own" on public.scanplay_profiles;
drop policy if exists "scanplay_decks_own" on public.scanplay_decks;
drop policy if exists "scanplay_mistakes_own" on public.scanplay_mistakes;
drop policy if exists "scanplay_user_stats_own" on public.scanplay_user_stats;

drop policy if exists "scanplay_profiles_select_own" on public.scanplay_profiles;
drop policy if exists "scanplay_profiles_insert_own" on public.scanplay_profiles;
drop policy if exists "scanplay_profiles_update_own" on public.scanplay_profiles;
drop policy if exists "scanplay_profiles_delete_own" on public.scanplay_profiles;
create policy "scanplay_profiles_select_own" on public.scanplay_profiles for select using (auth.uid() = user_id);
create policy "scanplay_profiles_insert_own" on public.scanplay_profiles for insert with check (auth.uid() = user_id);
create policy "scanplay_profiles_update_own" on public.scanplay_profiles for update using (auth.uid() = user_id);
create policy "scanplay_profiles_delete_own" on public.scanplay_profiles for delete using (auth.uid() = user_id);

drop policy if exists "scanplay_decks_select_own" on public.scanplay_decks;
drop policy if exists "scanplay_decks_insert_own" on public.scanplay_decks;
drop policy if exists "scanplay_decks_update_own" on public.scanplay_decks;
drop policy if exists "scanplay_decks_delete_own" on public.scanplay_decks;
create policy "scanplay_decks_select_own" on public.scanplay_decks for select using (auth.uid() = user_id);
create policy "scanplay_decks_insert_own" on public.scanplay_decks for insert with check (auth.uid() = user_id);
create policy "scanplay_decks_update_own" on public.scanplay_decks for update using (auth.uid() = user_id);
create policy "scanplay_decks_delete_own" on public.scanplay_decks for delete using (auth.uid() = user_id);

drop policy if exists "scanplay_mistakes_select_own" on public.scanplay_mistakes;
drop policy if exists "scanplay_mistakes_insert_own" on public.scanplay_mistakes;
drop policy if exists "scanplay_mistakes_update_own" on public.scanplay_mistakes;
drop policy if exists "scanplay_mistakes_delete_own" on public.scanplay_mistakes;
create policy "scanplay_mistakes_select_own" on public.scanplay_mistakes for select using (auth.uid() = user_id);
create policy "scanplay_mistakes_insert_own" on public.scanplay_mistakes for insert with check (auth.uid() = user_id);
create policy "scanplay_mistakes_update_own" on public.scanplay_mistakes for update using (auth.uid() = user_id);
create policy "scanplay_mistakes_delete_own" on public.scanplay_mistakes for delete using (auth.uid() = user_id);

drop policy if exists "scanplay_user_stats_select_own" on public.scanplay_user_stats;
drop policy if exists "scanplay_user_stats_insert_own" on public.scanplay_user_stats;
drop policy if exists "scanplay_user_stats_update_own" on public.scanplay_user_stats;
drop policy if exists "scanplay_user_stats_delete_own" on public.scanplay_user_stats;
create policy "scanplay_user_stats_select_own" on public.scanplay_user_stats for select using (auth.uid() = user_id);
create policy "scanplay_user_stats_insert_own" on public.scanplay_user_stats for insert with check (auth.uid() = user_id);
create policy "scanplay_user_stats_update_own" on public.scanplay_user_stats for update using (auth.uid() = user_id);
create policy "scanplay_user_stats_delete_own" on public.scanplay_user_stats for delete using (auth.uid() = user_id);


-- 3. PROFIL à l'inscription (créé dès le signup, avant confirmation email)
-- ------------------------------------------------------------

create or replace function public.ensure_scanplay_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.scanplay_profiles (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  insert into public.scanplay_user_stats (user_id, data) values (auth.uid(), '{}'::jsonb)
  on conflict (user_id) do nothing;
end;
$$;

grant execute on function public.ensure_scanplay_profile() to authenticated;

create or replace function public.handle_scanplay_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.scanplay_profiles (user_id, xp, streak, plan, locale)
  values (new.id, 0, 0, 'free', 'fr')
  on conflict (user_id) do nothing;
  insert into public.scanplay_user_stats (user_id, data)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_scanplay_auth_user_created on auth.users;
create trigger on_scanplay_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_scanplay_new_user();


-- 4. DÉSACTIVER l'auto-confirmation (obligatoire pour les emails)
-- ------------------------------------------------------------
-- Supprime le contournement qui empêchait l'envoi d'email de confirmation.

drop trigger if exists on_scanplay_auto_confirm on auth.users;
drop function if exists public.auto_confirm_scanplay_user();


-- 5. BACKFILL profils (sans toucher email_confirmed_at)
-- ------------------------------------------------------------

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


-- 6. VÉRIFICATION
-- ------------------------------------------------------------

select
  u.email,
  u.email_confirmed_at is not null as email_confirmed,
  u.confirmation_sent_at,
  p.plan,
  (select count(*) from public.scanplay_decks d where d.user_id = u.id) as decks
from auth.users u
left join public.scanplay_profiles p on p.user_id = u.id
order by u.created_at desc
limit 10;

-- Attendu après une nouvelle inscription (Confirm email ON) :
--   email_confirmed = false
--   confirmation_sent_at = date récente
--   → l'utilisateur reçoit l'email et clique le lien
