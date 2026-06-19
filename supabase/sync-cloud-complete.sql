-- ============================================================
-- ScanPlay — SYNC CLOUD COMPLET (compte connecté uniquement)
-- Exécuter dans Supabase → SQL Editor → Run
--
-- Ce script correspond à l'app déployée sur https://scanplay.org :
--   • Plus de données invité : tout est lié au user_id
--   • À la connexion : pull cloud → push snapshot complet
--   • Tables : profil (XP, streak, plan) + decks + erreurs + stats JSON
--
-- Dashboard (obligatoire en plus du SQL) :
--   Authentication → Providers → Email → Désactiver "Confirm email"
--   Authentication → URL Configuration
--     Site URL        : https://scanplay.org
--     Redirect URLs   : https://scanplay.org/**
-- ============================================================


-- 1. TABLES
-- ------------------------------------------------------------
-- scanplay_profiles     → XP, série, plan, locale (sync push/pull)
-- scanplay_decks        → historique des fiches scannées
-- scanplay_mistakes     → erreurs à revoir
-- scanplay_user_stats   → blob JSON : best scores, scans, succès
--
-- Structure attendue dans scanplay_user_stats.data :
-- {
--   "best": { "flashcards": 100, "quiz": 50, "match": 80 },
--   "multiScans": 0,
--   "examPasses": 0,
--   "scansDay": { "2026-05-30": 3 }
-- }

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

create index if not exists scanplay_decks_user_created_idx
  on public.scanplay_decks (user_id, created_at desc);

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


-- 2. PERMISSIONS
-- ------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;


-- 3. ROW LEVEL SECURITY (chaque user ne voit que ses données)
-- ------------------------------------------------------------

alter table public.scanplay_profiles enable row level security;
alter table public.scanplay_decks enable row level security;
alter table public.scanplay_mistakes enable row level security;
alter table public.scanplay_user_stats enable row level security;

-- Nettoyer anciennes policies (noms variés selon scripts précédents)
drop policy if exists "scanplay_profiles_own" on public.scanplay_profiles;
drop policy if exists "scanplay_decks_own" on public.scanplay_decks;
drop policy if exists "scanplay_mistakes_own" on public.scanplay_mistakes;
drop policy if exists "scanplay_user_stats_own" on public.scanplay_user_stats;

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

-- Decks
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

-- Mistakes
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

-- Stats blob
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


-- 4. RPC appelée par l'app au login (ensure_scanplay_profile)
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

  insert into public.scanplay_profiles (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  insert into public.scanplay_user_stats (user_id, data)
  values (auth.uid(), '{}'::jsonb)
  on conflict (user_id) do nothing;
end;
$$;

grant execute on function public.ensure_scanplay_profile() to authenticated;


-- 5. PROFIL VIDE à chaque nouvelle inscription (pas de merge invité)
-- ------------------------------------------------------------

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


-- 6. FIX EMAIL : auto-confirmer (confirmed_at = colonne générée, ne pas la toucher)
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

update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null;


-- 7. BACKFILL comptes existants sans profil cloud
-- ------------------------------------------------------------

insert into public.scanplay_profiles (user_id, xp, streak, plan, locale)
select u.id, 0, 0, 'free', 'fr'
from auth.users u
where not exists (
  select 1 from public.scanplay_profiles p where p.user_id = u.id
)
on conflict (user_id) do nothing;

insert into public.scanplay_user_stats (user_id, data)
select u.id, '{}'::jsonb
from auth.users u
where not exists (
  select 1 from public.scanplay_user_stats s where s.user_id = u.id
)
on conflict (user_id) do nothing;


-- 8. (OPTIONNEL) Réinitialiser un compte pour repartir de zéro
-- Décommente et remplace l'email si tu veux effacer les données cloud d'un user :
--
-- do $$
-- declare
--   uid uuid;
-- begin
--   select id into uid from auth.users where email = 'ton@email.com';
--   if uid is not null then
--     delete from public.scanplay_decks where user_id = uid;
--     delete from public.scanplay_mistakes where user_id = uid;
--     update public.scanplay_profiles
--       set xp = 0, streak = 0, last_play_date = null, plan = 'free', updated_at = now()
--       where user_id = uid;
--     update public.scanplay_user_stats
--       set data = '{}'::jsonb, updated_at = now()
--       where user_id = uid;
--   end if;
-- end $$;


-- 9. VÉRIFICATION
-- ------------------------------------------------------------

select
  u.email,
  u.email_confirmed_at is not null as email_ok,
  p.xp,
  p.streak,
  p.plan,
  (select count(*) from public.scanplay_decks d where d.user_id = u.id) as decks,
  (select count(*) from public.scanplay_mistakes m where m.user_id = u.id) as mistakes,
  s.data
from auth.users u
left join public.scanplay_profiles p on p.user_id = u.id
left join public.scanplay_user_stats s on s.user_id = u.id
order by u.created_at desc
limit 10;
