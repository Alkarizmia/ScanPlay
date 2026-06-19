-- ============================================================
-- ScanPlay — SQL Supabase (à exécuter une fois)
-- Projet : https://makskleablwrmzhtbejc.supabase.co
-- Dashboard → SQL Editor → New query → Coller → Run
-- ============================================================

-- 1. Tables
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

create index if not exists scanplay_decks_user_id_idx
  on public.scanplay_decks (user_id);

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

create index if not exists scanplay_mistakes_user_id_idx
  on public.scanplay_mistakes (user_id);

create table if not exists public.scanplay_user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. Row Level Security
-- ------------------------------------------------------------

alter table public.scanplay_profiles enable row level security;
alter table public.scanplay_decks enable row level security;
alter table public.scanplay_mistakes enable row level security;
alter table public.scanplay_user_stats enable row level security;

-- Profiles
drop policy if exists "scanplay_profiles_select_own" on public.scanplay_profiles;
drop policy if exists "scanplay_profiles_insert_own" on public.scanplay_profiles;
drop policy if exists "scanplay_profiles_update_own" on public.scanplay_profiles;
drop policy if exists "scanplay_profiles_delete_own" on public.scanplay_profiles;

create policy "scanplay_profiles_select_own"
  on public.scanplay_profiles for select using (auth.uid() = user_id);
create policy "scanplay_profiles_insert_own"
  on public.scanplay_profiles for insert with check (auth.uid() = user_id);
create policy "scanplay_profiles_update_own"
  on public.scanplay_profiles for update using (auth.uid() = user_id);
create policy "scanplay_profiles_delete_own"
  on public.scanplay_profiles for delete using (auth.uid() = user_id);

-- Decks (historique)
drop policy if exists "scanplay_decks_select_own" on public.scanplay_decks;
drop policy if exists "scanplay_decks_insert_own" on public.scanplay_decks;
drop policy if exists "scanplay_decks_update_own" on public.scanplay_decks;
drop policy if exists "scanplay_decks_delete_own" on public.scanplay_decks;

create policy "scanplay_decks_select_own"
  on public.scanplay_decks for select using (auth.uid() = user_id);
create policy "scanplay_decks_insert_own"
  on public.scanplay_decks for insert with check (auth.uid() = user_id);
create policy "scanplay_decks_update_own"
  on public.scanplay_decks for update using (auth.uid() = user_id);
create policy "scanplay_decks_delete_own"
  on public.scanplay_decks for delete using (auth.uid() = user_id);

-- Mistakes (erreurs)
drop policy if exists "scanplay_mistakes_select_own" on public.scanplay_mistakes;
drop policy if exists "scanplay_mistakes_insert_own" on public.scanplay_mistakes;
drop policy if exists "scanplay_mistakes_update_own" on public.scanplay_mistakes;
drop policy if exists "scanplay_mistakes_delete_own" on public.scanplay_mistakes;

create policy "scanplay_mistakes_select_own"
  on public.scanplay_mistakes for select using (auth.uid() = user_id);
create policy "scanplay_mistakes_insert_own"
  on public.scanplay_mistakes for insert with check (auth.uid() = user_id);
create policy "scanplay_mistakes_update_own"
  on public.scanplay_mistakes for update using (auth.uid() = user_id);
create policy "scanplay_mistakes_delete_own"
  on public.scanplay_mistakes for delete using (auth.uid() = user_id);

-- Stats (scores, succès, scans)
drop policy if exists "scanplay_user_stats_select_own" on public.scanplay_user_stats;
drop policy if exists "scanplay_user_stats_insert_own" on public.scanplay_user_stats;
drop policy if exists "scanplay_user_stats_update_own" on public.scanplay_user_stats;
drop policy if exists "scanplay_user_stats_delete_own" on public.scanplay_user_stats;

create policy "scanplay_user_stats_select_own"
  on public.scanplay_user_stats for select using (auth.uid() = user_id);
create policy "scanplay_user_stats_insert_own"
  on public.scanplay_user_stats for insert with check (auth.uid() = user_id);
create policy "scanplay_user_stats_update_own"
  on public.scanplay_user_stats for update using (auth.uid() = user_id);
create policy "scanplay_user_stats_delete_own"
  on public.scanplay_user_stats for delete using (auth.uid() = user_id);

-- 3. Profil auto à l'inscription
-- ------------------------------------------------------------

create or replace function public.handle_scanplay_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.scanplay_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.scanplay_user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_scanplay_auth_user_created on auth.users;
create trigger on_scanplay_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_scanplay_new_user();

-- 4. Vérification (optionnel)
-- ------------------------------------------------------------
-- select tablename from pg_tables
-- where schemaname = 'public' and tablename like 'scanplay_%';
