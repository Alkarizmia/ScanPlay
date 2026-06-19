-- ============================================================
-- ScanPlay — FIX email confirmation + profils
-- Exécuter dans Supabase → SQL Editor → Run
--
-- IMPORTANT (Dashboard, en plus du SQL) :
-- Authentication → Providers → Email
--   → Désactive "Confirm email" tant que SMTP n'est pas OK
--   → OU configure SMTP (support@scanplay.org) correctement
-- Authentication → URL Configuration
--   → Site URL : https://scanplay.org
--   → Redirect URLs : https://scanplay.org/**
-- ============================================================

-- 1. Tables ScanPlay (si pas déjà fait)
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

create table if not exists public.scanplay_user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. Permissions + RLS
-- ------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;

alter table public.scanplay_profiles enable row level security;
alter table public.scanplay_decks enable row level security;
alter table public.scanplay_mistakes enable row level security;
alter table public.scanplay_user_stats enable row level security;

drop policy if exists "scanplay_profiles_own" on public.scanplay_profiles;
create policy "scanplay_profiles_own" on public.scanplay_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "scanplay_decks_own" on public.scanplay_decks;
create policy "scanplay_decks_own" on public.scanplay_decks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "scanplay_mistakes_own" on public.scanplay_mistakes;
create policy "scanplay_mistakes_own" on public.scanplay_mistakes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "scanplay_user_stats_own" on public.scanplay_user_stats;
create policy "scanplay_user_stats_own" on public.scanplay_user_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Profil auto à l'inscription
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
  insert into public.scanplay_user_stats (user_id) values (auth.uid())
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
  insert into public.scanplay_profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  insert into public.scanplay_user_stats (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_scanplay_auth_user_created on auth.users;
create trigger on_scanplay_auth_user_created
  after insert on auth.users for each row
  execute function public.handle_scanplay_new_user();

-- 4. FIX : confirmer les emails automatiquement
-- (contourne l'erreur "Error sending confirmation email")
-- Note : confirmed_at est une colonne générée → on met à jour email_confirmed_at seulement
-- ------------------------------------------------------------

create or replace function public.auto_confirm_scanplay_user()
returns trigger
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = new.id
    and email_confirmed_at is null;
  return new;
end;
$$;

drop trigger if exists on_scanplay_auto_confirm on auth.users;
create trigger on_scanplay_auto_confirm
  after insert on auth.users
  for each row
  execute function public.auto_confirm_scanplay_user();

-- Confirmer tous les comptes existants (confirmed_at se calcule automatiquement)
update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null;

-- 5. Backfill profils manquants
-- ------------------------------------------------------------

insert into public.scanplay_profiles (user_id)
select u.id from auth.users u
where not exists (select 1 from public.scanplay_profiles p where p.user_id = u.id)
on conflict (user_id) do nothing;

insert into public.scanplay_user_stats (user_id)
select u.id from auth.users u
where not exists (select 1 from public.scanplay_user_stats s where s.user_id = u.id)
on conflict (user_id) do nothing;

-- 6. Vérification
-- ------------------------------------------------------------

select id, email, email_confirmed_at is not null as confirmed, created_at
from auth.users
order by created_at desc
limit 10;
