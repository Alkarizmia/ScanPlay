-- ============================================================
-- ScanPlay — SETUP COMPLET PRODUCTION (nouveau projet Supabase)
-- Généré par: node scripts/build-supabase-setup.mjs
--
-- Usage:
--   1. Nouveau projet Supabase → SQL Editor → New query
--   2. Coller TOUT ce fichier → Run (1–3 min)
--   3. Configurer Auth SMTP + URLs (voir fin du fichier)
--   4. Vercel: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
--   5. Importer auth.users + données depuis l'ancien projet (voir migrate-users-data.sql)
--
-- Idempotent: safe à relancer (IF NOT EXISTS, CREATE OR REPLACE).
-- ============================================================



-- ═══════════════════════════════════════════════════════════
-- SOURCE: sync-cloud-complete.sql
-- ═══════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════
-- SOURCE: migration-exam-history.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — Mise à jour : historique Examens + colonnes decks
-- À exécuter dans Supabase → SQL Editor → New query → Run
--
-- Nouveautés app (scanplay.org) :
--   • Historique séparé : Parcours (decks) vs Examens
--   • Note finale d'examen, étapes, chrono, 70% min
--   • Profil utilisateur + examHistory dans stats JSON (déjà supporté)
--
-- Ce script est idempotent (safe à relancer).
-- ============================================================


-- 1. Colonnes optionnelles sur scanplay_decks (parcours)
-- ------------------------------------------------------------

alter table public.scanplay_decks
  add column if not exists last_score_pct int,
  add column if not exists last_xp_earned int,
  add column if not exists last_played_at timestamptz,
  add column if not exists play_count int not null default 0,
  add column if not exists kind text not null default 'deck'
    check (kind in ('deck'));

comment on column public.scanplay_decks.last_score_pct is 'Dernier % de la session (parcours libre)';
comment on column public.scanplay_decks.last_played_at is 'Dernière partie sur ce deck';
comment on column public.scanplay_decks.kind is 'deck = parcours normal (pas un examen final)';


-- 2. Table scanplay_exam_history (examens terminés)
-- ------------------------------------------------------------

create table if not exists public.scanplay_exam_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_id uuid not null,
  deck_title text not null,
  thumbnail text,
  final_grade int not null check (final_grade >= 0 and final_grade <= 100),
  passed boolean not null default false,
  step_grades jsonb not null default '[]'::jsonb,
  total_time_seconds int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.scanplay_exam_history is
  'Résultats finaux mode Examen (10 étapes, note moyenne, min 70% pour passed)';

comment on column public.scanplay_exam_history.step_grades is
  'JSON: [{ "stepIndex": 0, "mode": "quiz", "pct": 85, "passed": true }, ...]';

create index if not exists scanplay_exam_history_user_id_idx
  on public.scanplay_exam_history (user_id);

create index if not exists scanplay_exam_history_user_created_idx
  on public.scanplay_exam_history (user_id, created_at desc);

create index if not exists scanplay_exam_history_deck_id_idx
  on public.scanplay_exam_history (deck_id);


-- 3. RLS exam_history
-- ------------------------------------------------------------

alter table public.scanplay_exam_history enable row level security;

drop policy if exists "scanplay_exam_history_select_own" on public.scanplay_exam_history;
drop policy if exists "scanplay_exam_history_insert_own" on public.scanplay_exam_history;
drop policy if exists "scanplay_exam_history_update_own" on public.scanplay_exam_history;
drop policy if exists "scanplay_exam_history_delete_own" on public.scanplay_exam_history;

create policy "scanplay_exam_history_select_own"
  on public.scanplay_exam_history for select
  using (auth.uid() = user_id);

create policy "scanplay_exam_history_insert_own"
  on public.scanplay_exam_history for insert
  with check (auth.uid() = user_id);

create policy "scanplay_exam_history_update_own"
  on public.scanplay_exam_history for update
  using (auth.uid() = user_id);

create policy "scanplay_exam_history_delete_own"
  on public.scanplay_exam_history for delete
  using (auth.uid() = user_id);


-- 4. Rappel : blob scanplay_user_stats.data (pas de table SQL obligatoire)
-- ------------------------------------------------------------
-- L'app stocke aussi dans data JSON :
--   "profile"         → { displayName, avatar, customAvatarData }
--   "examHistory"     → copie locale (optionnel si table exam_history utilisée)
--   "notifications", "achievementUnlocks", "best", "scansDay", ...
--
-- Aucune migration requise pour user_stats si la table existe déjà.


-- 5. Vérification
-- ------------------------------------------------------------

-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'scanplay_exam_history'
-- order by ordinal_position;

-- select count(*) from public.scanplay_exam_history;


-- ═══════════════════════════════════════════════════════════
-- SOURCE: migration-social.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — Amis (follow) + Multijoueur (salons quiz)
-- À exécuter dans Supabase → SQL Editor → New query → Run
--
-- Prérequis : sync-cloud-complete.sql (+ migration-exam-history.sql si déjà déployé)
--
-- Fonctionnalités app :
--   • Profil public searchable (nom d'affichage)
--   • Suivre / ne plus suivre un joueur (scanplay_follows)
--   • Salons multijoueur quiz (code 6 caractères, Realtime)
--
-- Ce script est idempotent (safe à relancer).
-- ============================================================


-- 1. PROFILS PUBLICS (recherche d'amis)
-- ------------------------------------------------------------

create table if not exists public.scanplay_public_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_id text not null default 'avatar1'
    check (avatar_id in ('avatar1', 'avatar2', 'avatar3', 'avatar4', 'custom')),
  level int not null default 1 check (level >= 1),
  updated_at timestamptz not null default now()
);

comment on table public.scanplay_public_profiles is
  'Profil visible par les autres joueurs (recherche amis, salon multijoueur)';

create index if not exists scanplay_public_profiles_name_idx
  on public.scanplay_public_profiles (lower(display_name));


-- 2. FOLLOWS (relation « je suis » — asymétrique)
-- ------------------------------------------------------------

create table if not exists public.scanplay_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

comment on table public.scanplay_follows is
  'Graphe de suivi : follower_id suit following_id';

create index if not exists scanplay_follows_following_idx
  on public.scanplay_follows (following_id);

create index if not exists scanplay_follows_follower_idx
  on public.scanplay_follows (follower_id, created_at desc);


-- 3. SALONS MULTIJOUEUR
-- ------------------------------------------------------------

create table if not exists public.scanplay_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique,
  deck_title text not null,
  pairs jsonb not null default '[]'::jsonb,
  mode text not null default 'quiz' check (mode in ('quiz')),
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'finished')),
  seed text not null,
  max_players int not null default 4 check (max_players between 2 and 8),
  created_at timestamptz not null default now()
);

comment on table public.scanplay_rooms is
  'Salon multijoueur — quiz sur un deck partagé (pairs JSON snapshot)';

create index if not exists scanplay_rooms_code_idx
  on public.scanplay_rooms (upper(invite_code));

create index if not exists scanplay_rooms_host_idx
  on public.scanplay_rooms (host_id, created_at desc);

create table if not exists public.scanplay_room_players (
  room_id uuid not null references public.scanplay_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_id text not null default 'avatar1',
  score int not null default 0 check (score >= 0),
  total int not null default 0 check (total >= 0),
  finished_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

comment on table public.scanplay_room_players is
  'Joueurs présents dans un salon + score en fin de quiz';

create index if not exists scanplay_room_players_room_idx
  on public.scanplay_room_players (room_id, joined_at);


-- 4. BACKFILL profils publics (comptes existants)
-- ------------------------------------------------------------
-- Lit le blob stats JSON (profile.displayName) + XP pour le niveau.

insert into public.scanplay_public_profiles (user_id, display_name, avatar_id, level, updated_at)
select
  u.id,
  coalesce(
    nullif(trim(s.data -> 'profile' ->> 'displayName'), ''),
    'ID-' || lpad(
      (
        abs(hashtext(replace(u.id::text, '-', ''))) % 10000
      )::text,
      4,
      '0'
    )
  ) as display_name,
  coalesce(nullif(s.data -> 'profile' ->> 'avatar', ''), 'avatar1') as avatar_id,
  greatest(1, floor(sqrt(coalesce(p.xp, 0)::float / 50)) + 1)::int as level,
  now() as updated_at
from auth.users u
left join public.scanplay_user_stats s on s.user_id = u.id
left join public.scanplay_profiles p on p.user_id = u.id
on conflict (user_id) do update set
  display_name = excluded.display_name,
  avatar_id = excluded.avatar_id,
  level = excluded.level,
  updated_at = now();


-- 5. ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table public.scanplay_public_profiles enable row level security;
alter table public.scanplay_follows enable row level security;
alter table public.scanplay_rooms enable row level security;
alter table public.scanplay_room_players enable row level security;

-- Profils publics
drop policy if exists "public profiles read" on public.scanplay_public_profiles;
create policy "public profiles read" on public.scanplay_public_profiles
  for select to authenticated
  using (true);

drop policy if exists "public profiles upsert own" on public.scanplay_public_profiles;
create policy "public profiles upsert own" on public.scanplay_public_profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Follows
drop policy if exists "follows read own" on public.scanplay_follows;
create policy "follows read own" on public.scanplay_follows
  for select to authenticated
  using (auth.uid() = follower_id or auth.uid() = following_id);

drop policy if exists "follows insert own" on public.scanplay_follows;
create policy "follows insert own" on public.scanplay_follows
  for insert to authenticated
  with check (auth.uid() = follower_id);

drop policy if exists "follows delete own" on public.scanplay_follows;
create policy "follows delete own" on public.scanplay_follows
  for delete to authenticated
  using (auth.uid() = follower_id);

-- Salons
drop policy if exists "rooms read if player" on public.scanplay_rooms;
create policy "rooms read if player" on public.scanplay_rooms
  for select to authenticated
  using (
    host_id = auth.uid()
    or exists (
      select 1 from public.scanplay_room_players p
      where p.room_id = id and p.user_id = auth.uid()
    )
  );

drop policy if exists "rooms insert host" on public.scanplay_rooms;
create policy "rooms insert host" on public.scanplay_rooms
  for insert to authenticated
  with check (auth.uid() = host_id);

drop policy if exists "rooms update host" on public.scanplay_rooms;
create policy "rooms update host" on public.scanplay_rooms
  for update to authenticated
  using (auth.uid() = host_id);

-- Joueurs du salon
drop policy if exists "room players read if member" on public.scanplay_room_players;
create policy "room players read if member" on public.scanplay_room_players
  for select to authenticated
  using (
    exists (
      select 1 from public.scanplay_room_players p2
      where p2.room_id = room_id and p2.user_id = auth.uid()
    )
  );

drop policy if exists "room players insert self" on public.scanplay_room_players;
create policy "room players insert self" on public.scanplay_room_players
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "room players update self" on public.scanplay_room_players;
create policy "room players update self" on public.scanplay_room_players
  for update to authenticated
  using (auth.uid() = user_id);


-- 6. REALTIME (salon multijoueur)
-- ------------------------------------------------------------
-- Nécessaire pour que le salon se mette à jour en direct.

do $$
begin
  alter publication supabase_realtime add table public.scanplay_rooms;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.scanplay_room_players;
exception
  when duplicate_object then null;
end $$;


-- 7. RPC — AMIS
-- ------------------------------------------------------------

create or replace function public.search_players(p_query text)
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  level int,
  is_following boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.display_name,
    p.avatar_id,
    p.level,
    exists (
      select 1 from public.scanplay_follows f
      where f.follower_id = auth.uid() and f.following_id = p.user_id
    ) as is_following
  from public.scanplay_public_profiles p
  where auth.uid() is not null
    and p.user_id <> auth.uid()
    and char_length(trim(p_query)) >= 2
    and p.display_name ilike '%' || trim(p_query) || '%'
  order by p.display_name
  limit 20;
$$;

comment on function public.search_players(text) is
  'Recherche joueurs par nom (min. 2 caractères)';

create or replace function public.list_my_friends()
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  level int,
  followed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.display_name,
    p.avatar_id,
    p.level,
    f.created_at as followed_at
  from public.scanplay_follows f
  join public.scanplay_public_profiles p on p.user_id = f.following_id
  where f.follower_id = auth.uid()
  order by f.created_at desc
  limit 50;
$$;

comment on function public.list_my_friends() is
  'Liste des joueurs que je suis';

create or replace function public.follow_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_target = auth.uid() then
    raise exception 'cannot follow self';
  end if;
  if not exists (select 1 from public.scanplay_public_profiles where user_id = p_target) then
    raise exception 'player not found';
  end if;
  insert into public.scanplay_follows (follower_id, following_id)
  values (auth.uid(), p_target)
  on conflict do nothing;
end;
$$;

create or replace function public.unfollow_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from public.scanplay_follows
  where follower_id = auth.uid() and following_id = p_target;
end;
$$;


-- 8. RPC — MULTIJOUEUR
-- ------------------------------------------------------------

create or replace function public.join_room_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.scanplay_rooms;
  v_profile public.scanplay_public_profiles;
  v_count int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_room
  from public.scanplay_rooms
  where invite_code = upper(trim(p_code)) and status = 'waiting';

  if not found then
    raise exception 'room not found or already started';
  end if;

  select count(*) into v_count
  from public.scanplay_room_players
  where room_id = v_room.id;

  if v_count >= v_room.max_players then
    raise exception 'room full';
  end if;

  select * into v_profile
  from public.scanplay_public_profiles
  where user_id = v_uid;

  if not found then
    raise exception 'public profile required';
  end if;

  insert into public.scanplay_room_players (room_id, user_id, display_name, avatar_id)
  values (v_room.id, v_uid, v_profile.display_name, v_profile.avatar_id)
  on conflict (room_id, user_id) do nothing;

  return jsonb_build_object(
    'room_id', v_room.id,
    'invite_code', v_room.invite_code,
    'deck_title', v_room.deck_title,
    'status', v_room.status,
    'seed', v_room.seed,
    'host_id', v_room.host_id
  );
end;
$$;

create or replace function public.start_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.scanplay_rooms;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_room from public.scanplay_rooms where id = p_room_id;
  if not found then raise exception 'room not found'; end if;
  if v_room.host_id <> auth.uid() then raise exception 'not host'; end if;
  if v_room.status <> 'waiting' then raise exception 'already started'; end if;

  select count(*) into v_count
  from public.scanplay_room_players
  where room_id = p_room_id;

  if v_count < 2 then
    raise exception 'need at least 2 players';
  end if;

  update public.scanplay_rooms
  set status = 'playing'
  where id = p_room_id;
end;
$$;

-- Marque la partie terminée quand tous les joueurs ont un score
create or replace function public.finish_room_if_complete(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_done int;
begin
  if auth.uid() is null then return; end if;

  if not exists (
    select 1 from public.scanplay_room_players
    where room_id = p_room_id and user_id = auth.uid()
  ) then
    return;
  end if;

  select count(*), count(*) filter (where finished_at is not null)
  into v_total, v_done
  from public.scanplay_room_players
  where room_id = p_room_id;

  if v_total >= 2 and v_done = v_total then
    update public.scanplay_rooms
    set status = 'finished'
    where id = p_room_id and status = 'playing';
  end if;
end;
$$;

comment on function public.finish_room_if_complete(uuid) is
  'Passe le salon en finished si tous les joueurs ont terminé le quiz';


-- 9. DROITS
-- ------------------------------------------------------------

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.scanplay_public_profiles to authenticated;
grant select, insert, delete on public.scanplay_follows to authenticated;
grant select, insert, update on public.scanplay_rooms to authenticated;
grant select, insert, update on public.scanplay_room_players to authenticated;

grant execute on function public.search_players(text) to authenticated;
grant execute on function public.list_my_friends() to authenticated;
grant execute on function public.follow_user(uuid) to authenticated;
grant execute on function public.unfollow_user(uuid) to authenticated;
grant execute on function public.join_room_by_code(text) to authenticated;
grant execute on function public.start_room(uuid) to authenticated;
grant execute on function public.finish_room_if_complete(uuid) to authenticated;


-- ============================================================
-- Fin — Vérification rapide :
--   select tablename from pg_tables where tablename like 'scanplay_%';
--   select proname from pg_proc where proname like '%friend%' or proname like '%room%';
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- SOURCE: migration-social-friend-requests.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — Demandes d'amis + notifications sociales
-- À exécuter APRÈS migration-social.sql
-- Idempotent (safe à relancer)
-- ============================================================


-- 1. DEMANDES D'AMIS (remplace le follow instantané)
-- ------------------------------------------------------------

create table if not exists public.scanplay_friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create unique index if not exists scanplay_friend_requests_pair_idx
  on public.scanplay_friend_requests (
    least(from_user_id, to_user_id),
    greatest(from_user_id, to_user_id)
  );

create index if not exists scanplay_friend_requests_to_pending_idx
  on public.scanplay_friend_requests (to_user_id, created_at desc)
  where status = 'pending';

comment on table public.scanplay_friend_requests is
  'Demande d''ami : pending → accepted (amis) ou rejected';


-- Migrer les anciens follows (si présents) vers amis acceptés
insert into public.scanplay_friend_requests (from_user_id, to_user_id, status, created_at, updated_at)
select follower_id, following_id, 'accepted', created_at, created_at
from public.scanplay_follows
on conflict do nothing;


-- 2. NOTIFICATIONS SOCIALES (cross-user, Supabase)
-- ------------------------------------------------------------

create table if not exists public.scanplay_social_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('friend_request', 'friend_accepted')),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists scanplay_social_notif_user_idx
  on public.scanplay_social_notifications (user_id, created_at desc)
  where read_at is null;

comment on table public.scanplay_social_notifications is
  'Notifications reçues par un joueur (demandes d''ami, etc.)';


-- 3. STATS PUBLIQUES (visibles par les amis)
-- ------------------------------------------------------------

alter table public.scanplay_public_profiles
  add column if not exists xp int not null default 0,
  add column if not exists streak int not null default 0,
  add column if not exists deck_count int not null default 0;

update public.scanplay_public_profiles p
set
  xp = coalesce(sp.xp, 0),
  streak = coalesce(sp.streak, 0),
  level = greatest(1, floor(sqrt(coalesce(sp.xp, 0)::float / 50)) + 1)::int
from public.scanplay_profiles sp
where sp.user_id = p.user_id;

update public.scanplay_public_profiles p
set deck_count = coalesce(d.c, 0)
from (
  select user_id, count(*)::int as c
  from public.scanplay_decks
  group by user_id
) d
where d.user_id = p.user_id;


-- 4. RLS
-- ------------------------------------------------------------

alter table public.scanplay_friend_requests enable row level security;
alter table public.scanplay_social_notifications enable row level security;

drop policy if exists "friend requests read own" on public.scanplay_friend_requests;
create policy "friend requests read own" on public.scanplay_friend_requests
  for select to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid());

drop policy if exists "social notif read own" on public.scanplay_social_notifications;
create policy "social notif read own" on public.scanplay_social_notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "social notif update own" on public.scanplay_social_notifications;
create policy "social notif update own" on public.scanplay_social_notifications
  for update to authenticated
  using (user_id = auth.uid());


-- 5. RPC — RECHERCHE (statut relation)
-- ------------------------------------------------------------
-- PostgreSQL refuse CREATE OR REPLACE si le type de retour change
-- (ex. is_following → friend_status). On drop d'abord les anciennes versions.

drop function if exists public.search_players(text);
drop function if exists public.list_my_friends();

create or replace function public.search_players(p_query text)
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  level int,
  friend_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.display_name,
    p.avatar_id,
    p.level,
    case
      when exists (
        select 1 from public.scanplay_friend_requests fr
        where fr.status = 'accepted'
          and (
            (fr.from_user_id = auth.uid() and fr.to_user_id = p.user_id)
            or (fr.from_user_id = p.user_id and fr.to_user_id = auth.uid())
          )
      ) then 'friends'
      when exists (
        select 1 from public.scanplay_friend_requests fr
        where fr.status = 'pending' and fr.from_user_id = auth.uid() and fr.to_user_id = p.user_id
      ) then 'pending_sent'
      when exists (
        select 1 from public.scanplay_friend_requests fr
        where fr.status = 'pending' and fr.from_user_id = p.user_id and fr.to_user_id = auth.uid()
      ) then 'pending_received'
      else 'none'
    end as friend_status
  from public.scanplay_public_profiles p
  where auth.uid() is not null
    and p.user_id <> auth.uid()
    and char_length(trim(p_query)) >= 2
    and p.display_name ilike '%' || trim(p_query) || '%'
  order by p.display_name
  limit 20;
$$;

comment on function public.search_players(text) is
  'Recherche joueurs par nom avec statut ami (none/pending/friends)';

create or replace function public.list_my_friends()
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  level int,
  xp int,
  streak int,
  deck_count int,
  friends_since timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.display_name,
    p.avatar_id,
    p.level,
    p.xp,
    p.streak,
    p.deck_count,
    fr.updated_at as friends_since
  from public.scanplay_friend_requests fr
  join public.scanplay_public_profiles p
    on p.user_id = case
      when fr.from_user_id = auth.uid() then fr.to_user_id
      else fr.from_user_id
    end
  where fr.status = 'accepted'
    and (fr.from_user_id = auth.uid() or fr.to_user_id = auth.uid())
  order by fr.updated_at desc
  limit 100;
$$;

comment on function public.list_my_friends() is
  'Liste des amis acceptés avec stats publiques';

-- 6. RPC — COMPTEUR & PROFIL
-- ------------------------------------------------------------

create or replace function public.count_my_friends()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.scanplay_friend_requests fr
  where fr.status = 'accepted'
    and (fr.from_user_id = auth.uid() or fr.to_user_id = auth.uid());
$$;

create or replace function public.get_friend_profile(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_profile public.scanplay_public_profiles;
begin
  if v_me is null then return null; end if;
  if p_user_id = v_me then return null; end if;

  if not exists (
    select 1 from public.scanplay_friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.from_user_id = v_me and fr.to_user_id = p_user_id)
        or (fr.from_user_id = p_user_id and fr.to_user_id = v_me)
      )
  ) then
    raise exception 'not friends';
  end if;

  select * into v_profile from public.scanplay_public_profiles where user_id = p_user_id;
  if not found then return null; end if;

  return jsonb_build_object(
    'user_id', v_profile.user_id,
    'display_name', v_profile.display_name,
    'avatar_id', v_profile.avatar_id,
    'level', v_profile.level,
    'xp', v_profile.xp,
    'streak', v_profile.streak,
    'deck_count', v_profile.deck_count
  );
end;
$$;


-- 7. RPC — DEMANDES
-- ------------------------------------------------------------

create or replace function public.send_friend_request(p_target uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_request_id uuid;
  v_from_name text;
  v_from_avatar text;
  v_existing public.scanplay_friend_requests;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if p_target = v_me then raise exception 'cannot add self'; end if;
  if not exists (select 1 from public.scanplay_public_profiles where user_id = p_target) then
    raise exception 'player not found';
  end if;

  select * into v_existing
  from public.scanplay_friend_requests fr
  where least(fr.from_user_id, fr.to_user_id) = least(v_me, p_target)
    and greatest(fr.from_user_id, fr.to_user_id) = greatest(v_me, p_target);

  if found then
    if v_existing.status = 'accepted' then raise exception 'already friends'; end if;
    if v_existing.status = 'pending' and v_existing.from_user_id = v_me then
      return v_existing.id;
    end if;
    if v_existing.status = 'pending' and v_existing.to_user_id = v_me then
      raise exception 'they already sent you a request';
    end if;
    update public.scanplay_friend_requests
    set status = 'pending', from_user_id = v_me, to_user_id = p_target,
        updated_at = now(), created_at = now()
    where id = v_existing.id
    returning id into v_request_id;
  else
    insert into public.scanplay_friend_requests (from_user_id, to_user_id, status)
    values (v_me, p_target, 'pending')
    returning id into v_request_id;
  end if;

  select display_name, avatar_id into v_from_name, v_from_avatar
  from public.scanplay_public_profiles where user_id = v_me;

  insert into public.scanplay_social_notifications (user_id, kind, payload)
  values (
    p_target,
    'friend_request',
    jsonb_build_object(
      'request_id', v_request_id,
      'from_user_id', v_me,
      'from_display_name', v_from_name,
      'from_avatar_id', v_from_avatar
    )
  );

  return v_request_id;
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_req public.scanplay_friend_requests;
  v_my_name text;
begin
  if v_me is null then raise exception 'not authenticated'; end if;

  select * into v_req from public.scanplay_friend_requests where id = p_request_id;
  if not found then raise exception 'request not found'; end if;
  if v_req.to_user_id <> v_me then raise exception 'not your request'; end if;
  if v_req.status <> 'pending' then raise exception 'already handled'; end if;

  update public.scanplay_friend_requests
  set status = case when p_accept then 'accepted' else 'rejected' end,
      updated_at = now()
  where id = p_request_id;

  update public.scanplay_social_notifications
  set read_at = now()
  where user_id = v_me
    and kind = 'friend_request'
    and payload ->> 'request_id' = p_request_id::text;

  if p_accept then
    select display_name into v_my_name
    from public.scanplay_public_profiles where user_id = v_me;

    insert into public.scanplay_social_notifications (user_id, kind, payload)
    values (
      v_req.from_user_id,
      'friend_accepted',
      jsonb_build_object(
        'from_user_id', v_me,
        'from_display_name', v_my_name
      )
    );
  end if;
end;
$$;

create or replace function public.remove_friend(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not authenticated'; end if;

  delete from public.scanplay_friend_requests
  where status = 'accepted'
    and (
      (from_user_id = v_me and to_user_id = p_target)
      or (from_user_id = p_target and to_user_id = v_me)
    );
end;
$$;


-- 8. RPC — NOTIFICATIONS SOCIALES
-- ------------------------------------------------------------

create or replace function public.list_social_notifications(p_limit int default 20)
returns table (
  id uuid,
  kind text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, kind, payload, read_at, created_at
  from public.scanplay_social_notifications
  where user_id = auth.uid()
  order by created_at desc
  limit greatest(1, least(p_limit, 50));
$$;

create or replace function public.count_unread_social_notifications()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.scanplay_social_notifications
  where user_id = auth.uid() and read_at is null;
$$;

create or replace function public.mark_social_notification_read(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.scanplay_social_notifications
  set read_at = now()
  where id = p_id and user_id = auth.uid();
$$;


-- 9. SYNC profil public (XP / streak / decks) — appelle au save profil
-- ------------------------------------------------------------

create or replace function public.sync_public_profile_stats(
  p_display_name text,
  p_avatar_id text,
  p_xp int,
  p_streak int,
  p_deck_count int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  insert into public.scanplay_public_profiles (
    user_id, display_name, avatar_id, level, xp, streak, deck_count, updated_at
  )
  values (
    auth.uid(),
    left(trim(p_display_name), 24),
    coalesce(nullif(p_avatar_id, ''), 'avatar1'),
    greatest(1, floor(sqrt(greatest(0, p_xp)::float / 50)) + 1)::int,
    greatest(0, p_xp),
    greatest(0, p_streak),
    greatest(0, p_deck_count),
    now()
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    avatar_id = excluded.avatar_id,
    level = excluded.level,
    xp = excluded.xp,
    streak = excluded.streak,
    deck_count = excluded.deck_count,
    updated_at = now();
end;
$$;


-- 10. DROITS
-- ------------------------------------------------------------

grant select on public.scanplay_friend_requests to authenticated;
grant select, update on public.scanplay_social_notifications to authenticated;

grant execute on function public.search_players(text) to authenticated;
grant execute on function public.list_my_friends() to authenticated;
grant execute on function public.count_my_friends() to authenticated;
grant execute on function public.get_friend_profile(uuid) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.list_social_notifications(int) to authenticated;
grant execute on function public.count_unread_social_notifications() to authenticated;
grant execute on function public.mark_social_notification_read(uuid) to authenticated;
grant execute on function public.sync_public_profile_stats(text, text, int, int, int) to authenticated;

-- Realtime pour notifications entrantes
do $$
begin
  alter publication supabase_realtime add table public.scanplay_social_notifications;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- Fin
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- SOURCE: fix-multiplayer-rooms.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — Fix « Impossible de créer la partie »
-- Exécuter dans Supabase → SQL Editor (projet makskleablwrmzhtbejc)
-- Safe à relancer (idempotent)
--
-- Prérequis recommandés (dans l'ordre) :
--   1. sync-cloud-complete.sql
--   2. migration-social.sql
--   3. migration-social-friend-requests.sql
--   4. patch-friend-profile-plan.sql
-- ============================================================


-- 1. TABLES SALONS (si migration-social pas encore lancée)
-- ------------------------------------------------------------

create table if not exists public.scanplay_public_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_id text not null default 'avatar1'
    check (avatar_id in ('avatar1', 'avatar2', 'avatar3', 'avatar4', 'custom')),
  level int not null default 1 check (level >= 1),
  updated_at timestamptz not null default now()
);

alter table public.scanplay_public_profiles
  add column if not exists xp int not null default 0,
  add column if not exists streak int not null default 0,
  add column if not exists deck_count int not null default 0,
  add column if not exists plan text not null default 'free'
    check (plan in ('free', 'plus', 'pro'));

create table if not exists public.scanplay_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique,
  deck_title text not null,
  pairs jsonb not null default '[]'::jsonb,
  mode text not null default 'quiz' check (mode in ('quiz')),
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'finished')),
  seed text not null,
  max_players int not null default 4 check (max_players between 2 and 8),
  created_at timestamptz not null default now()
);

create table if not exists public.scanplay_room_players (
  room_id uuid not null references public.scanplay_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_id text not null default 'avatar1',
  score int not null default 0 check (score >= 0),
  total int not null default 0 check (total >= 0),
  finished_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists scanplay_rooms_code_idx
  on public.scanplay_rooms (upper(invite_code));

create index if not exists scanplay_rooms_host_idx
  on public.scanplay_rooms (host_id, created_at desc);


-- 2. RLS + POLITIQUES CORRIGÉES
-- ------------------------------------------------------------

alter table public.scanplay_public_profiles enable row level security;
alter table public.scanplay_rooms enable row level security;
alter table public.scanplay_room_players enable row level security;

drop policy if exists "public profiles read" on public.scanplay_public_profiles;
create policy "public profiles read" on public.scanplay_public_profiles
  for select to authenticated using (true);

drop policy if exists "public profiles upsert own" on public.scanplay_public_profiles;
create policy "public profiles upsert own" on public.scanplay_public_profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "rooms read if player" on public.scanplay_rooms;
create policy "rooms read if player" on public.scanplay_rooms
  for select to authenticated
  using (
    host_id = auth.uid()
    or exists (
      select 1 from public.scanplay_room_players p
      where p.room_id = id and p.user_id = auth.uid()
    )
  );

drop policy if exists "rooms insert host" on public.scanplay_rooms;
create policy "rooms insert host" on public.scanplay_rooms
  for insert to authenticated
  with check (auth.uid() = host_id);

drop policy if exists "rooms update host" on public.scanplay_rooms;
create policy "rooms update host" on public.scanplay_rooms
  for update to authenticated
  using (auth.uid() = host_id);

drop policy if exists "room players read if member" on public.scanplay_room_players;
create policy "room players read if member" on public.scanplay_room_players
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.scanplay_room_players p2
      where p2.room_id = room_id and p2.user_id = auth.uid()
    )
    or exists (
      select 1 from public.scanplay_rooms r
      where r.id = room_id and r.host_id = auth.uid()
    )
  );

drop policy if exists "room players insert self" on public.scanplay_room_players;
create policy "room players insert self" on public.scanplay_room_players
  for insert to authenticated
  with check (auth.uid() = user_id);


-- 3. SYNC PROFIL PUBLIC (6 params — aligné avec l'app)
-- ------------------------------------------------------------

drop function if exists public.sync_public_profile_stats(text, text, int, int, int);
drop function if exists public.sync_public_profile_stats(text, text, int, int, int, text);

create or replace function public.sync_public_profile_stats(
  p_display_name text,
  p_avatar_id text,
  p_xp int,
  p_streak int,
  p_deck_count int,
  p_plan text default 'free'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := coalesce(nullif(trim(p_plan), ''), 'free');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if v_plan not in ('free', 'plus', 'pro') then v_plan := 'free'; end if;

  insert into public.scanplay_public_profiles (
    user_id, display_name, avatar_id, level, xp, streak, deck_count, plan, updated_at
  )
  values (
    auth.uid(),
    left(trim(coalesce(p_display_name, 'Joueur')), 24),
    coalesce(nullif(p_avatar_id, ''), 'avatar1'),
    greatest(1, floor(sqrt(greatest(0, p_xp)::float / 50)) + 1)::int,
    greatest(0, p_xp),
    greatest(0, p_streak),
    greatest(0, p_deck_count),
    v_plan,
    now()
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    avatar_id = excluded.avatar_id,
    level = excluded.level,
    xp = excluded.xp,
    streak = excluded.streak,
    deck_count = excluded.deck_count,
    plan = excluded.plan,
    updated_at = now();
end;
$$;


-- 4. RPC — CRÉER UN SALON / PARCOURS PARTAGÉ (contourne les blocages RLS)
-- ------------------------------------------------------------

create or replace function public.create_path_room(
  p_deck_title text,
  p_pairs jsonb,
  p_seed text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.scanplay_public_profiles;
  v_room public.scanplay_rooms;
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i int;
  v_attempt int := 0;
  v_display text;
  v_avatar text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_pairs is null or jsonb_typeof(p_pairs) <> 'array' or jsonb_array_length(p_pairs) < 1 then
    raise exception 'pairs required';
  end if;

  select * into v_profile from public.scanplay_public_profiles where user_id = v_uid;
  if not found then
    insert into public.scanplay_public_profiles (user_id, display_name, avatar_id)
    values (v_uid, 'Joueur', 'avatar1');
    select * into v_profile from public.scanplay_public_profiles where user_id = v_uid;
  end if;

  v_display := left(trim(coalesce(v_profile.display_name, 'Joueur')), 24);
  v_avatar := coalesce(nullif(v_profile.avatar_id, ''), 'avatar1');

  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 8 then
      raise exception 'could not generate invite code';
    end if;

    v_code := '';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;

    begin
      insert into public.scanplay_rooms (
        host_id, invite_code, deck_title, pairs, seed, status
      )
      values (
        v_uid,
        v_code,
        left(coalesce(p_deck_title, 'ScanPlay'), 60),
        p_pairs,
        coalesce(p_seed, md5(random()::text)),
        'waiting'
      )
      returning * into v_room;

      exit;
    exception
      when unique_violation then
        continue;
    end;
  end loop;

  insert into public.scanplay_room_players (room_id, user_id, display_name, avatar_id)
  values (v_room.id, v_uid, v_display, v_avatar)
  on conflict (room_id, user_id) do update set
    display_name = excluded.display_name,
    avatar_id = excluded.avatar_id;

  return jsonb_build_object(
    'id', v_room.id,
    'host_id', v_room.host_id,
    'invite_code', v_room.invite_code,
    'deck_title', v_room.deck_title,
    'pairs', v_room.pairs,
    'mode', v_room.mode,
    'status', v_room.status,
    'seed', v_room.seed,
    'max_players', v_room.max_players,
    'created_at', v_room.created_at
  );
end;
$$;


-- 5. RPC — REJOINDRE PAR CODE (recréé si absent)
-- ------------------------------------------------------------

create or replace function public.join_room_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.scanplay_rooms;
  v_profile public.scanplay_public_profiles;
  v_count int;
  v_display text;
  v_avatar text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_room
  from public.scanplay_rooms
  where invite_code = upper(trim(p_code)) and status = 'waiting';

  if not found then
    raise exception 'room not found or already started';
  end if;

  select count(*) into v_count from public.scanplay_room_players where room_id = v_room.id;
  if v_count >= v_room.max_players then
    raise exception 'room full';
  end if;

  select * into v_profile from public.scanplay_public_profiles where user_id = v_uid;
  if not found then
    insert into public.scanplay_public_profiles (user_id, display_name, avatar_id)
    values (v_uid, 'Joueur', 'avatar1');
    select * into v_profile from public.scanplay_public_profiles where user_id = v_uid;
  end if;

  v_display := left(trim(coalesce(v_profile.display_name, 'Joueur')), 24);
  v_avatar := coalesce(nullif(v_profile.avatar_id, ''), 'avatar1');

  insert into public.scanplay_room_players (room_id, user_id, display_name, avatar_id)
  values (v_room.id, v_uid, v_display, v_avatar)
  on conflict (room_id, user_id) do nothing;

  return jsonb_build_object(
    'room_id', v_room.id,
    'invite_code', v_room.invite_code,
    'deck_title', v_room.deck_title,
    'status', v_room.status,
    'seed', v_room.seed,
    'host_id', v_room.host_id,
    'pairs', v_room.pairs
  );
end;
$$;


-- 6. DROITS
-- ------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.scanplay_public_profiles to authenticated;
grant select, insert, update on public.scanplay_rooms to authenticated;
grant select, insert, update on public.scanplay_room_players to authenticated;

grant execute on function public.sync_public_profile_stats(text, text, int, int, int, text) to authenticated;
grant execute on function public.create_path_room(text, jsonb, text) to authenticated;
grant execute on function public.join_room_by_code(text) to authenticated;

-- Realtime salons
do $$
begin
  alter publication supabase_realtime add table public.scanplay_rooms;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.scanplay_room_players;
exception when duplicate_object then null;
end $$;


-- ============================================================
-- Vérification :
--   select tablename from pg_tables where tablename like 'scanplay_room%';
--   select proname from pg_proc where proname in ('create_path_room', 'join_room_by_code');
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- SOURCE: patch-friend-profile-plan.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — Profil ami : plan (Free/Plus/Pro) + nb d'amis
-- Exécuter dans Supabase → SQL Editor (après migration-social-friend-requests.sql)
-- ============================================================

alter table public.scanplay_public_profiles
  add column if not exists plan text not null default 'free'
  check (plan in ('free', 'plus', 'pro'));

update public.scanplay_public_profiles pp
set plan = coalesce(sp.plan, 'free')
from public.scanplay_profiles sp
where sp.user_id = pp.user_id;

drop function if exists public.sync_public_profile_stats(text, text, int, int, int);

create or replace function public.sync_public_profile_stats(
  p_display_name text,
  p_avatar_id text,
  p_xp int,
  p_streak int,
  p_deck_count int,
  p_plan text default 'free'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := coalesce(nullif(trim(p_plan), ''), 'free');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if v_plan not in ('free', 'plus', 'pro') then v_plan := 'free'; end if;

  insert into public.scanplay_public_profiles (
    user_id, display_name, avatar_id, level, xp, streak, deck_count, plan, updated_at
  )
  values (
    auth.uid(),
    left(trim(p_display_name), 24),
    coalesce(nullif(p_avatar_id, ''), 'avatar1'),
    greatest(1, floor(sqrt(greatest(0, p_xp)::float / 50)) + 1)::int,
    greatest(0, p_xp),
    greatest(0, p_streak),
    greatest(0, p_deck_count),
    v_plan,
    now()
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    avatar_id = excluded.avatar_id,
    level = excluded.level,
    xp = excluded.xp,
    streak = excluded.streak,
    deck_count = excluded.deck_count,
    plan = excluded.plan,
    updated_at = now();
end;
$$;

create or replace function public.get_friend_profile(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_profile public.scanplay_public_profiles;
  v_friend_count int;
  v_plan text;
begin
  if v_me is null then return null; end if;
  if p_user_id = v_me then return null; end if;

  if not exists (
    select 1 from public.scanplay_friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.from_user_id = v_me and fr.to_user_id = p_user_id)
        or (fr.from_user_id = p_user_id and fr.to_user_id = v_me)
      )
  ) then
    raise exception 'not friends';
  end if;

  select * into v_profile from public.scanplay_public_profiles where user_id = p_user_id;
  if not found then return null; end if;

  select count(*)::int into v_friend_count
  from public.scanplay_friend_requests fr
  where fr.status = 'accepted'
    and (fr.from_user_id = p_user_id or fr.to_user_id = p_user_id);

  select coalesce(sp.plan, v_profile.plan, 'free') into v_plan
  from public.scanplay_profiles sp
  where sp.user_id = p_user_id;

  if v_plan is null or v_plan not in ('free', 'plus', 'pro') then
    v_plan := coalesce(v_profile.plan, 'free');
  end if;

  return jsonb_build_object(
    'user_id', v_profile.user_id,
    'display_name', v_profile.display_name,
    'avatar_id', v_profile.avatar_id,
    'level', v_profile.level,
    'xp', v_profile.xp,
    'streak', v_profile.streak,
    'deck_count', v_profile.deck_count,
    'plan', v_plan,
    'friend_count', v_friend_count
  );
end;
$$;

grant execute on function public.sync_public_profile_stats(text, text, int, int, int, text) to authenticated;
grant execute on function public.get_friend_profile(uuid) to authenticated;


-- ═══════════════════════════════════════════════════════════
-- SOURCE: stripe-subscription-complete.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — ABONNEMENTS STRIPE (script complet)
-- Exécuter dans Supabase → SQL Editor → Run
--
-- Corrige : plan bloqué sur "free" après paiement Stripe
-- Prérequis Vercel : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
--   SUPABASE_SERVICE_ROLE_KEY, STRIPE_PRICE_PLUS_*, STRIPE_PRICE_PRO_*
-- ============================================================


-- 1. Colonnes Stripe sur scanplay_profiles
-- ------------------------------------------------------------

alter table public.scanplay_profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists billing_cycle text,
  add column if not exists subscription_period_end timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean not null default false;

-- Contrainte billing_cycle (ignore si déjà là)
do $$
begin
  alter table public.scanplay_profiles
    add constraint scanplay_profiles_billing_cycle_check
    check (billing_cycle is null or billing_cycle in ('monthly', 'annual'));
exception
  when duplicate_object then null;
end $$;

-- Plan doit rester free | plus | pro
do $$
begin
  alter table public.scanplay_profiles
    add constraint scanplay_profiles_plan_check
    check (plan in ('free', 'plus', 'pro'));
exception
  when duplicate_object then null;
end $$;

create unique index if not exists scanplay_profiles_stripe_subscription_id_idx
  on public.scanplay_profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists scanplay_profiles_stripe_customer_id_idx
  on public.scanplay_profiles (stripe_customer_id)
  where stripe_customer_id is not null;


-- 2. Colonnes sync série (si pas encore fait)
-- ------------------------------------------------------------

alter table public.scanplay_profiles
  add column if not exists streak_lost_value int not null default 0,
  add column if not exists streak_lost_at bigint,
  add column if not exists streak_lost_ack_at bigint;


-- 3. Vérifier ton profil (remplace l'email)
-- ------------------------------------------------------------

select
  u.id as user_id,
  u.email,
  p.plan,
  p.billing_cycle,
  p.stripe_customer_id,
  p.stripe_subscription_id,
  p.stripe_price_id,
  p.subscription_period_end,
  p.subscription_cancel_at_period_end,
  p.updated_at
from auth.users u
left join public.scanplay_profiles p on p.user_id = u.id
where u.email = 'TON_EMAIL@example.com';


-- 4. Correction manuelle immédiate (après paiement Pro validé)
--    Remplace l'email. Les IDs Stripe sont optionnels mais recommandés.
-- ------------------------------------------------------------

/*
update public.scanplay_profiles p
set
  plan = 'pro',
  billing_cycle = 'monthly',
  stripe_customer_id = 'cus_XXXXXXXXXXXX',
  stripe_subscription_id = 'sub_XXXXXXXXXXXX',
  stripe_price_id = 'price_XXXXXXXXXXXX',
  subscription_period_end = now() + interval '1 month',
  subscription_cancel_at_period_end = false,
  updated_at = now()
from auth.users u
where p.user_id = u.id
  and u.email = 'TON_EMAIL@example.com';
*/


-- 5. Forcer Pro pour TON compte (version simple sans IDs Stripe)
-- ------------------------------------------------------------

/*
update public.scanplay_profiles p
set
  plan = 'pro',
  billing_cycle = 'monthly',
  subscription_period_end = now() + interval '1 month',
  subscription_cancel_at_period_end = false,
  updated_at = now()
from auth.users u
where p.user_id = u.id
  and u.email = 'TON_EMAIL@example.com';
*/


-- 6. Créer le profil s'il manque (rare)
-- ------------------------------------------------------------

insert into public.scanplay_profiles (user_id, xp, streak, plan, locale)
select u.id, 0, 0, 'free', 'fr'
from auth.users u
where u.email = 'TON_EMAIL@example.com'
  and not exists (
    select 1 from public.scanplay_profiles p where p.user_id = u.id
  );


-- 7. Diagnostic : tous les profils payants
-- ------------------------------------------------------------

select
  u.email,
  p.plan,
  p.billing_cycle,
  p.stripe_subscription_id,
  p.subscription_period_end,
  p.updated_at
from public.scanplay_profiles p
join auth.users u on u.id = p.user_id
where p.plan in ('plus', 'pro')
order by p.updated_at desc;


-- ═══════════════════════════════════════════════════════════
-- SOURCE: migration-friend-achievements.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — Succès partagés entre amis + classement
-- Exécuter dans Supabase → SQL Editor (après patch-friend-profile-plan.sql)
-- Safe à relancer (idempotent)
-- ============================================================

alter table public.scanplay_public_profiles
  add column if not exists achievement_unlocks jsonb not null default '[]'::jsonb;

-- Sync des succès débloqués (visible par les amis)
create or replace function public.sync_public_achievement_unlocks(p_unlocks jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  if p_unlocks is not null and jsonb_typeof(p_unlocks) = 'array' then
    select coalesce(jsonb_agg(elem), '[]'::jsonb)
    into v_clean
    from (
      select elem
      from jsonb_array_elements(p_unlocks) elem
      where jsonb_typeof(elem) = 'object'
        and (elem->>'id') is not null
        and length(trim(elem->>'id')) > 0
      limit 50
    ) sub;
  end if;

  insert into public.scanplay_public_profiles (user_id, display_name, avatar_id, achievement_unlocks)
  values (v_uid, 'Joueur', 'avatar1', v_clean)
  on conflict (user_id) do update set
    achievement_unlocks = excluded.achievement_unlocks,
    updated_at = now();
end;
$$;

-- Liste amis avec nb de succès
drop function if exists public.list_my_friends();

create or replace function public.list_my_friends()
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  level int,
  xp int,
  streak int,
  deck_count int,
  achievement_count int,
  friends_since timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.display_name,
    p.avatar_id,
    p.level,
    p.xp,
    p.streak,
    p.deck_count,
    coalesce(jsonb_array_length(p.achievement_unlocks), 0)::int as achievement_count,
    fr.updated_at as friends_since
  from public.scanplay_friend_requests fr
  join public.scanplay_public_profiles p
    on p.user_id = case
      when fr.from_user_id = auth.uid() then fr.to_user_id
      else fr.from_user_id
    end
  where fr.status = 'accepted'
    and (fr.from_user_id = auth.uid() or fr.to_user_id = auth.uid())
  order by p.xp desc, jsonb_array_length(p.achievement_unlocks) desc nulls last
  limit 100;
$$;

-- Profil ami : inclut les succès
create or replace function public.get_friend_profile(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_profile public.scanplay_public_profiles;
  v_friend_count int;
  v_plan text;
begin
  if v_me is null then return null; end if;
  if p_user_id = v_me then return null; end if;

  if not exists (
    select 1 from public.scanplay_friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.from_user_id = v_me and fr.to_user_id = p_user_id)
        or (fr.from_user_id = p_user_id and fr.to_user_id = v_me)
      )
  ) then
    raise exception 'not friends';
  end if;

  select * into v_profile from public.scanplay_public_profiles where user_id = p_user_id;
  if not found then return null; end if;

  select count(*)::int into v_friend_count
  from public.scanplay_friend_requests fr
  where fr.status = 'accepted'
    and (fr.from_user_id = p_user_id or fr.to_user_id = p_user_id);

  select coalesce(sp.plan, v_profile.plan, 'free') into v_plan
  from public.scanplay_profiles sp
  where sp.user_id = p_user_id;

  if v_plan is null or v_plan not in ('free', 'plus', 'pro') then
    v_plan := coalesce(v_profile.plan, 'free');
  end if;

  return jsonb_build_object(
    'user_id', v_profile.user_id,
    'display_name', v_profile.display_name,
    'avatar_id', v_profile.avatar_id,
    'level', v_profile.level,
    'xp', v_profile.xp,
    'streak', v_profile.streak,
    'deck_count', v_profile.deck_count,
    'plan', v_plan,
    'friend_count', v_friend_count,
    'achievement_unlocks', coalesce(v_profile.achievement_unlocks, '[]'::jsonb),
    'achievement_count', coalesce(jsonb_array_length(v_profile.achievement_unlocks), 0)
  );
end;
$$;

grant execute on function public.sync_public_achievement_unlocks(jsonb) to authenticated;
grant execute on function public.list_my_friends() to authenticated;
grant execute on function public.get_friend_profile(uuid) to authenticated;


-- ═══════════════════════════════════════════════════════════
-- SOURCE: patch-display-name-enforcement.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — Pseudos UNIQUES (fix « Nom déjà pris » non fonctionnel)
-- Exécuter dans Supabase → SQL Editor → Run
--
-- À lancer si deux comptes peuvent encore prendre le même pseudo
-- (ex. « Alkarizmia »). Réapplique l'index unique + les RPC corrigées.
-- ============================================================


-- 1. Résoudre les doublons existants (garde le plus ancien)
-- ------------------------------------------------------------
with ranked as (
  select
    user_id,
    display_name,
    row_number() over (
      partition by lower(trim(display_name))
      order by updated_at asc nulls last, user_id
    ) as rn
  from public.scanplay_public_profiles
  where char_length(trim(display_name)) >= 2
)
update public.scanplay_public_profiles p
set
  display_name = left(r.display_name, 18) || '-' || substr(replace(r.user_id::text, '-', ''), 1, 4),
  updated_at = now()
from ranked r
where p.user_id = r.user_id
  and r.rn > 1;


-- 2. Index unique (insensible à la casse et espaces)
-- ------------------------------------------------------------
drop index if exists public.scanplay_public_profiles_name_idx;
drop index if exists public.scanplay_public_profiles_name_unique_idx;
create unique index scanplay_public_profiles_name_unique_idx
  on public.scanplay_public_profiles (lower(trim(display_name)));


-- 3. Vérifier disponibilité
-- ------------------------------------------------------------
create or replace function public.check_display_name_available(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    char_length(trim(coalesce(p_name, ''))) >= 2
    and not exists (
      select 1
      from public.scanplay_public_profiles p
      where lower(trim(p.display_name)) = lower(left(trim(coalesce(p_name, '')), 24))
        and (auth.uid() is null or p.user_id <> auth.uid())
    );
$$;


-- 4. Sync profil public — refuse les pseudos déjà pris
-- ------------------------------------------------------------
drop function if exists public.sync_public_profile_stats(text, text, int, int, int);
drop function if exists public.sync_public_profile_stats(text, text, int, int, int, text);

create or replace function public.sync_public_profile_stats(
  p_display_name text,
  p_avatar_id text,
  p_xp int,
  p_streak int,
  p_deck_count int,
  p_plan text default 'free'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := coalesce(nullif(trim(p_plan), ''), 'free');
  v_name text := left(trim(coalesce(p_display_name, 'Joueur')), 24);
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if char_length(v_name) < 2 then
    raise exception 'display_name_invalid';
  end if;

  if v_plan not in ('free', 'plus', 'pro') then
    v_plan := 'free';
  end if;

  if exists (
    select 1
    from public.scanplay_public_profiles p
    where lower(trim(p.display_name)) = lower(v_name)
      and p.user_id <> auth.uid()
  ) then
    raise exception 'display_name_taken';
  end if;

  begin
    insert into public.scanplay_public_profiles (
      user_id, display_name, avatar_id, level, xp, streak, deck_count, plan, updated_at
    )
    values (
      auth.uid(),
      v_name,
      coalesce(nullif(p_avatar_id, ''), 'avatar1'),
      greatest(1, floor(sqrt(greatest(0, p_xp)::float / 50)) + 1)::int,
      greatest(0, p_xp),
      greatest(0, p_streak),
      greatest(0, p_deck_count),
      v_plan,
      now()
    )
    on conflict (user_id) do update set
      display_name = excluded.display_name,
      avatar_id = excluded.avatar_id,
      level = excluded.level,
      xp = excluded.xp,
      streak = excluded.streak,
      deck_count = excluded.deck_count,
      plan = excluded.plan,
      updated_at = now();
  exception
    when unique_violation then
      raise exception 'display_name_taken';
  end;
end;
$$;


-- 5. Recherche amis — correspondance exacte prioritaire
-- ------------------------------------------------------------
drop function if exists public.search_players(text);

create or replace function public.search_players(p_query text)
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  level int,
  friend_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.display_name,
    p.avatar_id,
    p.level,
    case
      when exists (
        select 1 from public.scanplay_friend_requests fr
        where fr.status = 'accepted'
          and (
            (fr.from_user_id = auth.uid() and fr.to_user_id = p.user_id)
            or (fr.from_user_id = p.user_id and fr.to_user_id = auth.uid())
          )
      ) then 'friends'
      when exists (
        select 1 from public.scanplay_friend_requests fr
        where fr.status = 'pending' and fr.from_user_id = auth.uid() and fr.to_user_id = p.user_id
      ) then 'pending_sent'
      when exists (
        select 1 from public.scanplay_friend_requests fr
        where fr.status = 'pending' and fr.from_user_id = p.user_id and fr.to_user_id = auth.uid()
      ) then 'pending_received'
      else 'none'
    end as friend_status
  from public.scanplay_public_profiles p
  where auth.uid() is not null
    and p.user_id <> auth.uid()
    and char_length(trim(p_query)) >= 2
    and (
      lower(trim(p.display_name)) = lower(trim(p_query))
      or p.display_name ilike '%' || trim(p_query) || '%'
    )
  order by
    case when lower(trim(p.display_name)) = lower(trim(p_query)) then 0 else 1 end,
    length(p.display_name),
    p.display_name
  limit 20;
$$;


grant execute on function public.check_display_name_available(text) to authenticated;
grant execute on function public.sync_public_profile_stats(text, text, int, int, int, text) to authenticated;
grant execute on function public.search_players(text) to authenticated;


-- ═══════════════════════════════════════════════════════════
-- SOURCE: patch-friend-presence.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — Présence amis (en ligne / hors ligne)
-- Exécuter dans Supabase → SQL Editor → Run
-- ============================================================

alter table public.scanplay_public_profiles
  add column if not exists last_seen_at timestamptz;

comment on column public.scanplay_public_profiles.last_seen_at is
  'Dernière activité app (heartbeat). En ligne si < 5 min.';


create or replace function public.touch_presence()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.scanplay_public_profiles
  set last_seen_at = v_now,
      updated_at = v_now
  where user_id = auth.uid();

  return v_now;
end;
$$;


drop function if exists public.list_my_friends();

create or replace function public.list_my_friends()
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  avatar_url text,
  level int,
  xp int,
  streak int,
  deck_count int,
  achievement_count int,
  friends_since timestamptz,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.display_name,
    p.avatar_id,
    p.avatar_url,
    p.level,
    p.xp,
    p.streak,
    p.deck_count,
    coalesce(jsonb_array_length(p.achievement_unlocks), 0)::int as achievement_count,
    fr.updated_at as friends_since,
    p.last_seen_at
  from public.scanplay_friend_requests fr
  join public.scanplay_public_profiles p
    on p.user_id = case
      when fr.from_user_id = auth.uid() then fr.to_user_id
      else fr.from_user_id
    end
  where fr.status = 'accepted'
    and (fr.from_user_id = auth.uid() or fr.to_user_id = auth.uid())
  order by p.xp desc, jsonb_array_length(p.achievement_unlocks) desc nulls last
  limit 100;
$$;


grant execute on function public.touch_presence() to authenticated;
grant execute on function public.list_my_friends() to authenticated;


-- ═══════════════════════════════════════════════════════════
-- SOURCE: patch-public-avatar-url.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — Photo de profil visible par les amis / recherche
-- Exécuter dans Supabase → SQL Editor → Run
--
-- Stocke l'URL data (JPEG galerie) dans scanplay_public_profiles.avatar_url
-- ============================================================

alter table public.scanplay_public_profiles
  add column if not exists avatar_url text;

comment on column public.scanplay_public_profiles.avatar_url is
  'Photo personnalisée (data URL JPEG) quand avatar_id = custom';


-- Backfill depuis le blob cloud local
update public.scanplay_public_profiles pp
set avatar_url = left(nullif(trim(s.data -> 'profile' ->> 'customAvatarData'), ''), 200000)
from public.scanplay_user_stats s
where s.user_id = pp.user_id
  and coalesce(pp.avatar_id, 'avatar1') = 'custom'
  and coalesce(s.data -> 'profile' ->> 'avatar', '') = 'custom'
  and nullif(trim(s.data -> 'profile' ->> 'customAvatarData'), '') is not null
  and (pp.avatar_url is null or pp.avatar_url = '');


-- Sync profil public (avec pseudo unique + photo)
drop function if exists public.sync_public_profile_stats(text, text, int, int, int);
drop function if exists public.sync_public_profile_stats(text, text, int, int, int, text);
drop function if exists public.sync_public_profile_stats(text, text, int, int, int, text, text);

create or replace function public.sync_public_profile_stats(
  p_display_name text,
  p_avatar_id text,
  p_xp int,
  p_streak int,
  p_deck_count int,
  p_plan text default 'free',
  p_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := coalesce(nullif(trim(p_plan), ''), 'free');
  v_name text := left(trim(coalesce(p_display_name, 'Joueur')), 24);
  v_avatar text := coalesce(nullif(p_avatar_id, ''), 'avatar1');
  v_url text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if char_length(v_name) < 2 then
    raise exception 'display_name_invalid';
  end if;

  if v_plan not in ('free', 'plus', 'pro') then
    v_plan := 'free';
  end if;

  if exists (
    select 1
    from public.scanplay_public_profiles p
    where lower(trim(p.display_name)) = lower(v_name)
      and p.user_id <> auth.uid()
  ) then
    raise exception 'display_name_taken';
  end if;

  if v_avatar = 'custom' then
    v_url := nullif(left(trim(coalesce(p_avatar_url, '')), 200000), '');
  else
    v_url := null;
  end if;

  begin
    insert into public.scanplay_public_profiles (
      user_id, display_name, avatar_id, avatar_url, level, xp, streak, deck_count, plan, updated_at
    )
    values (
      auth.uid(),
      v_name,
      v_avatar,
      v_url,
      greatest(1, floor(sqrt(greatest(0, p_xp)::float / 50)) + 1)::int,
      greatest(0, p_xp),
      greatest(0, p_streak),
      greatest(0, p_deck_count),
      v_plan,
      now()
    )
    on conflict (user_id) do update set
      display_name = excluded.display_name,
      avatar_id = excluded.avatar_id,
      avatar_url = excluded.avatar_url,
      level = excluded.level,
      xp = excluded.xp,
      streak = excluded.streak,
      deck_count = excluded.deck_count,
      plan = excluded.plan,
      updated_at = now();
  exception
    when unique_violation then
      raise exception 'display_name_taken';
  end;
end;
$$;


-- Recherche joueurs
drop function if exists public.search_players(text);

create or replace function public.search_players(p_query text)
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  avatar_url text,
  level int,
  friend_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.display_name,
    p.avatar_id,
    p.avatar_url,
    p.level,
    case
      when exists (
        select 1 from public.scanplay_friend_requests fr
        where fr.status = 'accepted'
          and (
            (fr.from_user_id = auth.uid() and fr.to_user_id = p.user_id)
            or (fr.from_user_id = p.user_id and fr.to_user_id = auth.uid())
          )
      ) then 'friends'
      when exists (
        select 1 from public.scanplay_friend_requests fr
        where fr.status = 'pending' and fr.from_user_id = auth.uid() and fr.to_user_id = p.user_id
      ) then 'pending_sent'
      when exists (
        select 1 from public.scanplay_friend_requests fr
        where fr.status = 'pending' and fr.from_user_id = p.user_id and fr.to_user_id = auth.uid()
      ) then 'pending_received'
      else 'none'
    end as friend_status
  from public.scanplay_public_profiles p
  where auth.uid() is not null
    and p.user_id <> auth.uid()
    and char_length(trim(p_query)) >= 2
    and (
      lower(trim(p.display_name)) = lower(trim(p_query))
      or p.display_name ilike '%' || trim(p_query) || '%'
    )
  order by
    case when lower(trim(p.display_name)) = lower(trim(p_query)) then 0 else 1 end,
    length(p.display_name),
    p.display_name
  limit 20;
$$;


-- Liste amis
drop function if exists public.list_my_friends();

create or replace function public.list_my_friends()
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  avatar_url text,
  level int,
  xp int,
  streak int,
  deck_count int,
  achievement_count int,
  friends_since timestamptz,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.display_name,
    p.avatar_id,
    p.avatar_url,
    p.level,
    p.xp,
    p.streak,
    p.deck_count,
    coalesce(jsonb_array_length(p.achievement_unlocks), 0)::int as achievement_count,
    fr.updated_at as friends_since,
    p.last_seen_at
  from public.scanplay_friend_requests fr
  join public.scanplay_public_profiles p
    on p.user_id = case
      when fr.from_user_id = auth.uid() then fr.to_user_id
      else fr.from_user_id
    end
  where fr.status = 'accepted'
    and (fr.from_user_id = auth.uid() or fr.to_user_id = auth.uid())
  order by p.xp desc, jsonb_array_length(p.achievement_unlocks) desc nulls last
  limit 100;
$$;


-- Demandes en attente
drop function if exists public.list_pending_friend_requests();

create or replace function public.list_pending_friend_requests()
returns table (
  request_id uuid,
  from_user_id uuid,
  display_name text,
  avatar_id text,
  avatar_url text,
  level int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fr.id as request_id,
    fr.from_user_id,
    coalesce(p.display_name, 'Joueur') as display_name,
    coalesce(p.avatar_id, 'avatar1') as avatar_id,
    p.avatar_url,
    coalesce(p.level, 1) as level,
    fr.created_at
  from public.scanplay_friend_requests fr
  left join public.scanplay_public_profiles p on p.user_id = fr.from_user_id
  where fr.status = 'pending'
    and fr.to_user_id = auth.uid()
  order by fr.created_at desc
  limit 50;
$$;


-- Profil ami
create or replace function public.get_friend_profile(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_profile public.scanplay_public_profiles;
  v_friend_count int;
  v_plan text;
begin
  if v_me is null then return null; end if;
  if p_user_id = v_me then return null; end if;

  if not exists (
    select 1 from public.scanplay_friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.from_user_id = v_me and fr.to_user_id = p_user_id)
        or (fr.from_user_id = p_user_id and fr.to_user_id = v_me)
      )
  ) then
    raise exception 'not friends';
  end if;

  select * into v_profile from public.scanplay_public_profiles where user_id = p_user_id;
  if not found then return null; end if;

  select count(*)::int into v_friend_count
  from public.scanplay_friend_requests fr
  where fr.status = 'accepted'
    and (fr.from_user_id = p_user_id or fr.to_user_id = p_user_id);

  select coalesce(sp.plan, v_profile.plan, 'free') into v_plan
  from public.scanplay_profiles sp
  where sp.user_id = p_user_id;

  if v_plan is null or v_plan not in ('free', 'plus', 'pro') then
    v_plan := coalesce(v_profile.plan, 'free');
  end if;

  return jsonb_build_object(
    'user_id', v_profile.user_id,
    'display_name', v_profile.display_name,
    'avatar_id', v_profile.avatar_id,
    'avatar_url', v_profile.avatar_url,
    'level', v_profile.level,
    'xp', v_profile.xp,
    'streak', v_profile.streak,
    'deck_count', v_profile.deck_count,
    'plan', v_plan,
    'friend_count', v_friend_count,
    'achievement_unlocks', coalesce(v_profile.achievement_unlocks, '[]'::jsonb),
    'achievement_count', coalesce(jsonb_array_length(v_profile.achievement_unlocks), 0)
  );
end;
$$;


grant execute on function public.sync_public_profile_stats(text, text, int, int, int, text, text) to authenticated;
grant execute on function public.search_players(text) to authenticated;
grant execute on function public.list_my_friends() to authenticated;
grant execute on function public.list_pending_friend_requests() to authenticated;
grant execute on function public.get_friend_profile(uuid) to authenticated;


-- ═══════════════════════════════════════════════════════════
-- SOURCE: patch-friend-profile-stats-fix.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — Profil ami : stats + succès persistants (hors ligne OK)
-- Exécuter dans Supabase → SQL Editor → Run
-- ============================================================


-- 1. touch_presence : ne crée plus un profil vide « Joueur »
-- ------------------------------------------------------------
create or replace function public.touch_presence()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.scanplay_public_profiles
  set last_seen_at = v_now,
      updated_at = v_now
  where user_id = auth.uid();

  return v_now;
end;
$$;


-- 2. Sync succès : ne réinitialise plus le reste du profil
-- ------------------------------------------------------------
create or replace function public.sync_public_achievement_unlocks(p_unlocks jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_unlocks is not null and jsonb_typeof(p_unlocks) = 'array' then
    select coalesce(jsonb_agg(elem), '[]'::jsonb)
    into v_clean
    from (
      select elem
      from jsonb_array_elements(p_unlocks) elem
      where jsonb_typeof(elem) = 'object'
        and nullif(trim(elem ->> 'id'), '') is not null
      limit 50
    ) sub;
  end if;

  insert into public.scanplay_public_profiles (user_id, display_name, avatar_id, achievement_unlocks)
  values (v_uid, 'Joueur', 'avatar1', v_clean)
  on conflict (user_id) do update set
    achievement_unlocks = excluded.achievement_unlocks,
    updated_at = now();
end;
$$;


-- 3. Fusion succès (profil public + blob cloud)
-- ------------------------------------------------------------
create or replace function public.merge_achievement_unlocks(p_public jsonb, p_stats jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'unlockedAt', unlocked_at
      )
      order by unlocked_at desc
    ),
    '[]'::jsonb
  )
  from (
    select distinct on (id)
      id,
      unlocked_at
    from (
      select
        nullif(trim(elem ->> 'id'), '') as id,
        coalesce(
          nullif(trim(elem ->> 'unlockedAt'), ''),
          nullif(trim(elem ->> 'unlocked_at'), ''),
          '1970-01-01T00:00:00Z'
        ) as unlocked_at
      from jsonb_array_elements(coalesce(p_public, '[]'::jsonb)) elem
      union all
      select
        nullif(trim(elem ->> 'id'), ''),
        coalesce(
          nullif(trim(elem ->> 'unlockedAt'), ''),
          nullif(trim(elem ->> 'unlocked_at'), ''),
          '1970-01-01T00:00:00Z'
        )
      from jsonb_array_elements(coalesce(p_stats, '[]'::jsonb)) elem
    ) raw
    where id is not null
    order by id, unlocked_at desc
  ) deduped;
$$;


-- 4. Liste amis — dernières stats connues (même hors ligne)
-- ------------------------------------------------------------
drop function if exists public.list_my_friends();

create or replace function public.list_my_friends()
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  avatar_url text,
  level int,
  xp int,
  streak int,
  deck_count int,
  achievement_count int,
  friends_since timestamptz,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    case
      when nullif(trim(p.display_name), '') is not null
        and lower(trim(p.display_name)) not in ('joueur', 'player')
        then left(trim(p.display_name), 24)
      else left(
        trim(
          coalesce(
            nullif(trim(s.data -> 'profile' ->> 'displayName'), ''),
            nullif(trim(p.display_name), ''),
            'Joueur'
          )
        ),
        24
      )
    end as display_name,
    coalesce(nullif(p.avatar_id, ''), nullif(s.data -> 'profile' ->> 'avatar', ''), 'avatar1') as avatar_id,
    coalesce(
      p.avatar_url,
      case
        when coalesce(nullif(p.avatar_id, ''), s.data -> 'profile' ->> 'avatar') = 'custom'
          then nullif(trim(s.data -> 'profile' ->> 'customAvatarData'), '')
        else null
      end
    ) as avatar_url,
    greatest(
      coalesce(p.level, 1),
      greatest(1, floor(sqrt(greatest(0, coalesce(sp.xp, p.xp, 0))::float / 50)) + 1)::int
    ) as level,
    greatest(coalesce(p.xp, 0), coalesce(sp.xp, 0)) as xp,
    greatest(coalesce(p.streak, 0), coalesce(sp.streak, 0)) as streak,
    greatest(
      coalesce(p.deck_count, 0),
      coalesce((select count(*)::int from public.scanplay_decks d where d.user_id = p.user_id), 0)
    ) as deck_count,
    coalesce(
      jsonb_array_length(public.merge_achievement_unlocks(p.achievement_unlocks, s.data -> 'achievementUnlocks')),
      0
    )::int as achievement_count,
    fr.updated_at as friends_since,
    p.last_seen_at
  from public.scanplay_friend_requests fr
  join public.scanplay_public_profiles p
    on p.user_id = case
      when fr.from_user_id = auth.uid() then fr.to_user_id
      else fr.from_user_id
    end
  left join public.scanplay_profiles sp on sp.user_id = p.user_id
  left join public.scanplay_user_stats s on s.user_id = p.user_id
  where fr.status = 'accepted'
    and (fr.from_user_id = auth.uid() or fr.to_user_id = auth.uid())
  order by
    greatest(coalesce(p.xp, 0), coalesce(sp.xp, 0)) desc,
    coalesce(
      jsonb_array_length(public.merge_achievement_unlocks(p.achievement_unlocks, s.data -> 'achievementUnlocks')),
      0
    ) desc
  limit 100;
$$;


-- 5. Profil ami détaillé
-- ------------------------------------------------------------
create or replace function public.get_friend_profile(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_profile public.scanplay_public_profiles;
  v_stats jsonb;
  v_sp public.scanplay_profiles;
  v_friend_count int;
  v_plan text;
  v_name text;
  v_xp int;
  v_streak int;
  v_unlocks jsonb;
  v_count int;
begin
  if v_me is null then return null; end if;
  if p_user_id = v_me then return null; end if;

  if not exists (
    select 1 from public.scanplay_friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.from_user_id = v_me and fr.to_user_id = p_user_id)
        or (fr.from_user_id = p_user_id and fr.to_user_id = v_me)
      )
  ) then
    raise exception 'not friends';
  end if;

  select * into v_profile from public.scanplay_public_profiles where user_id = p_user_id;
  select data into v_stats from public.scanplay_user_stats where user_id = p_user_id;
  select * into v_sp from public.scanplay_profiles where user_id = p_user_id;

  if v_profile.user_id is null and v_stats is null and v_sp.user_id is null then
    return null;
  end if;

  v_name := case
    when v_profile.user_id is not null
      and nullif(trim(v_profile.display_name), '') is not null
      and lower(trim(v_profile.display_name)) not in ('joueur', 'player')
      then left(trim(v_profile.display_name), 24)
    else left(
      trim(
        coalesce(
          nullif(v_stats -> 'profile' ->> 'displayName', ''),
          nullif(v_profile.display_name, ''),
          'Joueur'
        )
      ),
      24
    )
  end;

  v_xp := greatest(coalesce(v_profile.xp, 0), coalesce(v_sp.xp, 0));
  v_streak := greatest(coalesce(v_profile.streak, 0), coalesce(v_sp.streak, 0));
  v_unlocks := public.merge_achievement_unlocks(
    coalesce(v_profile.achievement_unlocks, '[]'::jsonb),
    coalesce(v_stats -> 'achievementUnlocks', '[]'::jsonb)
  );
  v_count := coalesce(jsonb_array_length(v_unlocks), 0);

  select count(*)::int into v_friend_count
  from public.scanplay_friend_requests fr
  where fr.status = 'accepted'
    and (fr.from_user_id = p_user_id or fr.to_user_id = p_user_id);

  select coalesce(v_sp.plan, v_profile.plan, 'free') into v_plan;

  if v_plan is null or v_plan not in ('free', 'plus', 'pro') then
    v_plan := coalesce(v_profile.plan, 'free');
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'display_name', v_name,
    'avatar_id', coalesce(nullif(v_profile.avatar_id, ''), v_stats -> 'profile' ->> 'avatar', 'avatar1'),
    'avatar_url', coalesce(
      v_profile.avatar_url,
      case
        when coalesce(v_profile.avatar_id, v_stats -> 'profile' ->> 'avatar') = 'custom'
          then nullif(trim(v_stats -> 'profile' ->> 'customAvatarData'), '')
        else null
      end
    ),
    'level', greatest(coalesce(v_profile.level, 1), greatest(1, floor(sqrt(greatest(0, v_xp)::float / 50)) + 1)::int),
    'xp', v_xp,
    'streak', v_streak,
    'deck_count', greatest(
      coalesce(v_profile.deck_count, 0),
      coalesce((select count(*)::int from public.scanplay_decks d where d.user_id = p_user_id), 0)
    ),
    'plan', v_plan,
    'friend_count', v_friend_count,
    'achievement_unlocks', v_unlocks,
    'achievement_count', v_count
  );
end;
$$;


-- 6. Backfill profils publics depuis le cloud
-- ------------------------------------------------------------
update public.scanplay_public_profiles p
set
  display_name = left(
    trim(
      coalesce(
        nullif(trim(p.display_name), ''),
        nullif(s.data -> 'profile' ->> 'displayName', ''),
        p.display_name
      )
    ),
    24
  ),
  xp = greatest(coalesce(p.xp, 0), coalesce(sp.xp, 0)),
  streak = greatest(coalesce(p.streak, 0), coalesce(sp.streak, 0)),
  achievement_unlocks = public.merge_achievement_unlocks(
    p.achievement_unlocks,
    s.data -> 'achievementUnlocks'
  ),
  avatar_url = coalesce(
    p.avatar_url,
    case
      when coalesce(p.avatar_id, s.data -> 'profile' ->> 'avatar') = 'custom'
        then nullif(left(trim(s.data -> 'profile' ->> 'customAvatarData'), 200000), '')
      else null
    end
  ),
  updated_at = now()
from public.scanplay_user_stats s
left join public.scanplay_profiles sp on sp.user_id = s.user_id
where s.user_id = p.user_id;


grant execute on function public.touch_presence() to authenticated;
grant execute on function public.sync_public_achievement_unlocks(jsonb) to authenticated;
grant execute on function public.merge_achievement_unlocks(jsonb, jsonb) to authenticated;
grant execute on function public.list_my_friends() to authenticated;
grant execute on function public.get_friend_profile(uuid) to authenticated;


-- ═══════════════════════════════════════════════════════════
-- SOURCE: patch-friend-offline-display.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — Pseudo + succès amis hors ligne (complément)
-- Exécuter dans Supabase → SQL Editor → Run
-- (après patch-friend-profile-stats-fix.sql)
-- ============================================================

alter table public.scanplay_public_profiles
  add column if not exists achievement_count int not null default 0;


-- Nom affiché : profil public OU blob cloud (même hors ligne)
create or replace function public.resolve_friend_display_name(p_public_name text, p_stats jsonb)
returns text
language sql
immutable
as $$
  select left(
    trim(
      coalesce(
        nullif(
          case
            when nullif(trim(p_public_name), '') is not null
              and lower(trim(p_public_name)) not in ('joueur', 'player')
              and trim(p_public_name) !~ '^ID-[0-9]+$'
              then trim(p_public_name)
          end,
          ''
        ),
        nullif(trim(p_stats -> 'profile' ->> 'displayName'), ''),
        nullif(trim(p_public_name), ''),
        'Joueur'
      )
    ),
    24
  );
$$;


-- Nb succès : meilleure valeur connue (public + blob + total sync)
create or replace function public.resolve_friend_achievement_count(
  p_public_unlocks jsonb,
  p_stats jsonb,
  p_public_count int default 0
)
returns int
language sql
immutable
as $$
  select greatest(
    coalesce(p_public_count, 0),
    coalesce(jsonb_array_length(p_public_unlocks), 0),
    coalesce(jsonb_array_length(p_stats -> 'achievementUnlocks'), 0),
    coalesce(
      jsonb_array_length(
        public.merge_achievement_unlocks(p_public_unlocks, p_stats -> 'achievementUnlocks')
      ),
      0
    ),
    coalesce(nullif(trim(p_stats ->> 'achievementTotal'), '')::int, 0)
  )::int;
$$;


create or replace function public.sync_public_achievement_unlocks(p_unlocks jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean jsonb := '[]'::jsonb;
  v_count int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_unlocks is not null and jsonb_typeof(p_unlocks) = 'array' then
    select coalesce(jsonb_agg(elem), '[]'::jsonb)
    into v_clean
    from (
      select elem
      from jsonb_array_elements(p_unlocks) elem
      where jsonb_typeof(elem) = 'object'
        and nullif(trim(elem ->> 'id'), '') is not null
      limit 50
    ) sub;
  end if;

  v_count := coalesce(jsonb_array_length(v_clean), 0);

  insert into public.scanplay_public_profiles (user_id, display_name, avatar_id, achievement_unlocks, achievement_count)
  values (v_uid, 'Joueur', 'avatar1', v_clean, v_count)
  on conflict (user_id) do update set
    achievement_unlocks = excluded.achievement_unlocks,
    achievement_count = v_count,
    updated_at = now();
end;
$$;


drop function if exists public.list_my_friends();

create or replace function public.list_my_friends()
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  avatar_url text,
  level int,
  xp int,
  streak int,
  deck_count int,
  achievement_count int,
  friends_since timestamptz,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    public.resolve_friend_display_name(p.display_name, s.data) as display_name,
    coalesce(nullif(p.avatar_id, ''), nullif(s.data -> 'profile' ->> 'avatar', ''), 'avatar1') as avatar_id,
    coalesce(
      p.avatar_url,
      case
        when coalesce(nullif(p.avatar_id, ''), s.data -> 'profile' ->> 'avatar') = 'custom'
          then nullif(left(trim(s.data -> 'profile' ->> 'customAvatarData'), 200000), '')
        else null
      end
    ) as avatar_url,
    greatest(
      coalesce(p.level, 1),
      greatest(1, floor(sqrt(greatest(0, coalesce(sp.xp, p.xp, 0))::float / 50)) + 1)::int
    ) as level,
    greatest(coalesce(p.xp, 0), coalesce(sp.xp, 0)) as xp,
    greatest(coalesce(p.streak, 0), coalesce(sp.streak, 0)) as streak,
    greatest(
      coalesce(p.deck_count, 0),
      coalesce((select count(*)::int from public.scanplay_decks d where d.user_id = p.user_id), 0)
    ) as deck_count,
    public.resolve_friend_achievement_count(p.achievement_unlocks, s.data, p.achievement_count) as achievement_count,
    fr.updated_at as friends_since,
    p.last_seen_at
  from public.scanplay_friend_requests fr
  join public.scanplay_public_profiles p
    on p.user_id = case
      when fr.from_user_id = auth.uid() then fr.to_user_id
      else fr.from_user_id
    end
  left join public.scanplay_profiles sp on sp.user_id = p.user_id
  left join public.scanplay_user_stats s on s.user_id = p.user_id
  where fr.status = 'accepted'
    and (fr.from_user_id = auth.uid() or fr.to_user_id = auth.uid())
  order by
    greatest(coalesce(p.xp, 0), coalesce(sp.xp, 0)) desc,
    public.resolve_friend_achievement_count(p.achievement_unlocks, s.data, p.achievement_count) desc
  limit 100;
$$;


create or replace function public.get_friend_profile(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_profile public.scanplay_public_profiles;
  v_stats jsonb;
  v_sp public.scanplay_profiles;
  v_friend_count int;
  v_plan text;
  v_name text;
  v_xp int;
  v_streak int;
  v_unlocks jsonb;
  v_count int;
begin
  if v_me is null then return null; end if;
  if p_user_id = v_me then return null; end if;

  if not exists (
    select 1 from public.scanplay_friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.from_user_id = v_me and fr.to_user_id = p_user_id)
        or (fr.from_user_id = p_user_id and fr.to_user_id = v_me)
      )
  ) then
    raise exception 'not friends';
  end if;

  select * into v_profile from public.scanplay_public_profiles where user_id = p_user_id;
  select data into v_stats from public.scanplay_user_stats where user_id = p_user_id;
  select * into v_sp from public.scanplay_profiles where user_id = p_user_id;

  if v_profile.user_id is null and v_stats is null and v_sp.user_id is null then
    return null;
  end if;

  v_name := public.resolve_friend_display_name(v_profile.display_name, v_stats);
  v_xp := greatest(coalesce(v_profile.xp, 0), coalesce(v_sp.xp, 0));
  v_streak := greatest(coalesce(v_profile.streak, 0), coalesce(v_sp.streak, 0));
  v_unlocks := public.merge_achievement_unlocks(
    coalesce(v_profile.achievement_unlocks, '[]'::jsonb),
    coalesce(v_stats -> 'achievementUnlocks', '[]'::jsonb)
  );
  v_count := public.resolve_friend_achievement_count(
    coalesce(v_profile.achievement_unlocks, '[]'::jsonb),
    v_stats,
    v_profile.achievement_count
  );

  select count(*)::int into v_friend_count
  from public.scanplay_friend_requests fr
  where fr.status = 'accepted'
    and (fr.from_user_id = p_user_id or fr.to_user_id = p_user_id);

  select coalesce(v_sp.plan, v_profile.plan, 'free') into v_plan;

  if v_plan is null or v_plan not in ('free', 'plus', 'pro') then
    v_plan := coalesce(v_profile.plan, 'free');
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'display_name', v_name,
    'avatar_id', coalesce(nullif(v_profile.avatar_id, ''), v_stats -> 'profile' ->> 'avatar', 'avatar1'),
    'avatar_url', coalesce(
      v_profile.avatar_url,
      case
        when coalesce(v_profile.avatar_id, v_stats -> 'profile' ->> 'avatar') = 'custom'
          then nullif(left(trim(v_stats -> 'profile' ->> 'customAvatarData'), 200000), '')
        else null
      end
    ),
    'level', greatest(coalesce(v_profile.level, 1), greatest(1, floor(sqrt(greatest(0, v_xp)::float / 50)) + 1)::int),
    'xp', v_xp,
    'streak', v_streak,
    'deck_count', greatest(
      coalesce(v_profile.deck_count, 0),
      coalesce((select count(*)::int from public.scanplay_decks d where d.user_id = p_user_id), 0)
    ),
    'plan', v_plan,
    'friend_count', v_friend_count,
    'achievement_unlocks', v_unlocks,
    'achievement_count', v_count
  );
end;
$$;


-- Backfill compteurs + noms depuis le blob cloud
update public.scanplay_public_profiles p
set
  display_name = public.resolve_friend_display_name(p.display_name, s.data),
  achievement_count = public.resolve_friend_achievement_count(
    p.achievement_unlocks,
    s.data,
    p.achievement_count
  ),
  updated_at = now()
from public.scanplay_user_stats s
where s.user_id = p.user_id;


grant execute on function public.resolve_friend_display_name(text, jsonb) to authenticated;
grant execute on function public.resolve_friend_achievement_count(jsonb, jsonb, int) to authenticated;
grant execute on function public.sync_public_achievement_unlocks(jsonb) to authenticated;
grant execute on function public.list_my_friends() to authenticated;
grant execute on function public.get_friend_profile(uuid) to authenticated;


-- ═══════════════════════════════════════════════════════════
-- SOURCE: patch-friend-presence-fix.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — Présence + avatar amis (fix hors ligne)
-- Exécuter dans Supabase → SQL Editor → Run
-- (après patch-friend-offline-display.sql)
-- ============================================================

create or replace function public.clear_presence()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.scanplay_public_profiles
  set last_seen_at = null,
      updated_at = now()
  where user_id = auth.uid();
end;
$$;


create or replace function public.resolve_friend_avatar_id(p_avatar_id text, p_stats jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(p_avatar_id), ''),
    nullif(trim(p_stats -> 'profile' ->> 'avatar'), ''),
    case
      when nullif(left(trim(p_stats -> 'profile' ->> 'customAvatarData'), 200000), '') is not null
        then 'custom'
      else 'avatar1'
    end
  );
$$;


create or replace function public.resolve_friend_avatar_url(p_avatar_url text, p_stats jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(left(trim(coalesce(p_avatar_url, '')), 200000), ''),
    nullif(left(trim(p_stats -> 'profile' ->> 'customAvatarData'), 200000), '')
  );
$$;


drop function if exists public.list_my_friends();

create or replace function public.list_my_friends()
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  avatar_url text,
  level int,
  xp int,
  streak int,
  deck_count int,
  achievement_count int,
  friends_since timestamptz,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    public.resolve_friend_display_name(p.display_name, s.data) as display_name,
    public.resolve_friend_avatar_id(p.avatar_id, s.data) as avatar_id,
    public.resolve_friend_avatar_url(p.avatar_url, s.data) as avatar_url,
    greatest(
      coalesce(p.level, 1),
      greatest(1, floor(sqrt(greatest(0, coalesce(sp.xp, p.xp, 0))::float / 50)) + 1)::int
    ) as level,
    greatest(coalesce(p.xp, 0), coalesce(sp.xp, 0)) as xp,
    greatest(coalesce(p.streak, 0), coalesce(sp.streak, 0)) as streak,
    greatest(
      coalesce(p.deck_count, 0),
      coalesce((select count(*)::int from public.scanplay_decks d where d.user_id = p.user_id), 0)
    ) as deck_count,
    public.resolve_friend_achievement_count(p.achievement_unlocks, s.data, p.achievement_count) as achievement_count,
    fr.updated_at as friends_since,
    p.last_seen_at
  from public.scanplay_friend_requests fr
  join public.scanplay_public_profiles p
    on p.user_id = case
      when fr.from_user_id = auth.uid() then fr.to_user_id
      else fr.from_user_id
    end
  left join public.scanplay_profiles sp on sp.user_id = p.user_id
  left join public.scanplay_user_stats s on s.user_id = p.user_id
  where fr.status = 'accepted'
    and (fr.from_user_id = auth.uid() or fr.to_user_id = auth.uid())
  order by
    greatest(coalesce(p.xp, 0), coalesce(sp.xp, 0)) desc,
    public.resolve_friend_achievement_count(p.achievement_unlocks, s.data, p.achievement_count) desc
  limit 100;
$$;


grant execute on function public.clear_presence() to authenticated;
grant execute on function public.list_my_friends() to authenticated;


-- ═══════════════════════════════════════════════════════════
-- SOURCE: migration-scan-coins-system.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — Système ScanCoins (monnaie, shop, transferts amis)
-- Exécuter dans Supabase → SQL Editor → Run
--
-- Prérequis : migration-social-friend-requests.sql (table amis)
--
-- Ce script ajoute :
--   • scanplay_wallets          → solde ScanCoins (transferts entre amis)
--   • scanplay_coin_transfers   → historique des envois
--   • transfer_coins_to_friend  → RPC utilisée par l'app
--   • ensure_scanplay_wallet    → création portefeuille à l'inscription
--
-- État shop (coffre quotidien, potion XP x2, pub, flamme perdue…) :
--   synchronisé dans scanplay_user_stats.data.wallet (JSON local app)
--   Migration complète boutique v2 : patch-shop-wallet-v2.sql
--   Exemple :
--   {
--     "coins": 100,
--     "xpBoostUntil": null,
--     "lastDailyChest": "2026-05-30",
--     "lastAdRewardDate": "2026-05-30",
--     "adWatchesToday": 2,
--     "lostStreak": 0,
--     "lostStreakAt": null,
--     "extraScansDate": "2026-05-30",
--     "extraScansBought": 0,
--     "synthesisBonusCredits": 0,
--     "streakFreezeCharges": 0
--   }
--   Quota synthèse : data.synthesisMonth → { "month": "2026-05", "used": 1 }
-- ============================================================


-- 1. TABLE PORTEFEUILLE
-- ------------------------------------------------------------

create table if not exists public.scanplay_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  coins int not null default 100 check (coins >= 0 and coins <= 999999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.scanplay_wallets is
  'Solde ScanCoins côté serveur (transferts entre amis). Shop/coffre = blob user_stats.data.wallet.';


-- 2. HISTORIQUE DES TRANSFERTS
-- ------------------------------------------------------------

create table if not exists public.scanplay_coin_transfers (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null check (amount > 0 and amount <= 9999),
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create index if not exists scanplay_coin_transfers_from_idx
  on public.scanplay_coin_transfers (from_user_id, created_at desc);

create index if not exists scanplay_coin_transfers_to_idx
  on public.scanplay_coin_transfers (to_user_id, created_at desc);

comment on table public.scanplay_coin_transfers is
  'Journal des envois ScanCoins entre amis.';


-- 3. ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table public.scanplay_wallets enable row level security;
alter table public.scanplay_coin_transfers enable row level security;

drop policy if exists "wallet read own" on public.scanplay_wallets;
drop policy if exists "scanplay_wallets_select_own" on public.scanplay_wallets;

create policy "scanplay_wallets_select_own"
  on public.scanplay_wallets for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "coin transfers read own" on public.scanplay_coin_transfers;
drop policy if exists "scanplay_coin_transfers_select_own" on public.scanplay_coin_transfers;

create policy "scanplay_coin_transfers_select_own"
  on public.scanplay_coin_transfers for select
  to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid());


-- 4. FONCTIONS UTILITAIRES
-- ------------------------------------------------------------

create or replace function public.ensure_scanplay_wallet(p_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins int := 100;
begin
  if p_user_id is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(
    nullif((s.data -> 'wallet' ->> 'coins')::int, null),
    100
  )
  into v_coins
  from public.scanplay_user_stats s
  where s.user_id = p_user_id;

  if v_coins is null or v_coins < 0 then
    v_coins := 100;
  end if;

  insert into public.scanplay_wallets (user_id, coins)
  values (p_user_id, v_coins)
  on conflict (user_id) do nothing;
end;
$$;

comment on function public.ensure_scanplay_wallet(uuid) is
  'Crée un portefeuille (100 ScanCoins par défaut) si absent.';


create or replace function public.get_my_wallet()
returns table (coins int, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  perform public.ensure_scanplay_wallet(auth.uid());

  return query
  select w.coins, w.updated_at
  from public.scanplay_wallets w
  where w.user_id = auth.uid();
end;
$$;


create or replace function public.sync_wallet_coins(p_coins int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_new int;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if p_coins is null or p_coins < 0 or p_coins > 999999 then
    raise exception 'invalid coins';
  end if;

  perform public.ensure_scanplay_wallet(v_me);

  update public.scanplay_wallets
  set coins = p_coins,
      updated_at = now()
  where user_id = v_me
  returning coins into v_new;

  return v_new;
end;
$$;

comment on function public.sync_wallet_coins(int) is
  'Met à jour le solde serveur depuis le blob wallet local (sync cloud).';


-- 5. TRANSFERT ENTRE AMIS
-- ------------------------------------------------------------

create or replace function public.adjust_user_wallet_coins(p_user_id uuid, p_delta int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current int := 100;
  v_new int;
  v_wallet jsonb;
begin
  if p_user_id is null then
    raise exception 'invalid user';
  end if;

  insert into public.scanplay_user_stats (user_id, data)
  values (p_user_id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  select coalesce((s.data -> 'wallet' ->> 'coins')::int, 100)
  into v_current
  from public.scanplay_user_stats s
  where s.user_id = p_user_id
  for update;

  v_new := greatest(0, v_current + p_delta);

  select coalesce(s.data -> 'wallet', '{}'::jsonb)
  into v_wallet
  from public.scanplay_user_stats s
  where s.user_id = p_user_id;

  v_wallet := v_wallet || jsonb_build_object('coins', v_new);

  update public.scanplay_user_stats
  set data = jsonb_set(coalesce(data, '{}'::jsonb), '{wallet}', v_wallet),
      updated_at = now()
  where user_id = p_user_id;

  return v_new;
end;
$$;


create or replace function public.read_user_wallet_coins(p_user_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    coalesce(
      (select (s.data -> 'wallet' ->> 'coins')::int
       from public.scanplay_user_stats s
       where s.user_id = p_user_id),
      (select w.coins from public.scanplay_wallets w where w.user_id = p_user_id),
      100
    )
  );
$$;


create or replace function public.transfer_coins_to_friend(p_target uuid, p_amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_sender_coins int;
  v_receiver_coins int;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if p_target is null or p_target = v_me then
    raise exception 'invalid target';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 9999 then
    raise exception 'invalid amount';
  end if;

  if not exists (
    select 1
    from public.scanplay_friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.from_user_id = v_me and fr.to_user_id = p_target)
        or (fr.from_user_id = p_target and fr.to_user_id = v_me)
      )
  ) then
    raise exception 'not friends';
  end if;

  perform public.ensure_scanplay_wallet(v_me);
  perform public.ensure_scanplay_wallet(p_target);

  v_sender_coins := public.read_user_wallet_coins(v_me);

  if v_sender_coins < p_amount then
    raise exception 'insufficient coins';
  end if;

  update public.scanplay_wallets
  set coins = v_sender_coins - p_amount,
      updated_at = now()
  where user_id = v_me;

  select w.coins into v_receiver_coins
  from public.scanplay_wallets w
  where w.user_id = p_target
  for update;

  update public.scanplay_wallets
  set coins = coalesce(v_receiver_coins, 100) + p_amount,
      updated_at = now()
  where user_id = p_target;

  perform public.adjust_user_wallet_coins(p_target, p_amount);

  insert into public.scanplay_coin_transfers (from_user_id, to_user_id, amount)
  values (v_me, p_target, p_amount);
end;
$$;


create or replace function public.list_recent_coin_transfers(p_limit int default 20)
returns table (
  id uuid,
  direction text,
  other_user_id uuid,
  amount int,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  return query
  (
    select
      t.id,
      'sent'::text as direction,
      t.to_user_id as other_user_id,
      t.amount,
      t.created_at
    from public.scanplay_coin_transfers t
    where t.from_user_id = v_me

    union all

    select
      t.id,
      'received'::text as direction,
      t.from_user_id as other_user_id,
      t.amount,
      t.created_at
    from public.scanplay_coin_transfers t
    where t.to_user_id = v_me
  )
  order by created_at desc
  limit v_limit;
end;
$$;


-- 6. PORTEFEUILLE À L'INSCRIPTION + ensure_scanplay_profile
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

  perform public.ensure_scanplay_wallet(auth.uid());
end;
$$;


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

  insert into public.scanplay_wallets (user_id, coins)
  values (new.id, 100)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_scanplay_auth_user_created on auth.users;
create trigger on_scanplay_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_scanplay_new_user();


-- 7. BACKFILL UTILISATEURS EXISTANTS
-- ------------------------------------------------------------

insert into public.scanplay_wallets (user_id, coins)
select
  u.id,
  greatest(
    0,
    coalesce(
      nullif((s.data -> 'wallet' ->> 'coins')::int, null),
      100
    )
  )
from auth.users u
left join public.scanplay_user_stats s on s.user_id = u.id
on conflict (user_id) do update
set
  coins = greatest(
    scanplay_wallets.coins,
    excluded.coins
  ),
  updated_at = now()
where scanplay_wallets.coins < excluded.coins;


-- 8. PERMISSIONS
-- ------------------------------------------------------------

grant select on public.scanplay_wallets to authenticated;
grant select on public.scanplay_coin_transfers to authenticated;

grant execute on function public.adjust_user_wallet_coins(uuid, int) to authenticated;
grant execute on function public.read_user_wallet_coins(uuid) to authenticated;
grant execute on function public.ensure_scanplay_wallet(uuid) to authenticated;
grant execute on function public.get_my_wallet() to authenticated;
grant execute on function public.sync_wallet_coins(int) to authenticated;
grant execute on function public.transfer_coins_to_friend(uuid, int) to authenticated;
grant execute on function public.list_recent_coin_transfers(int) to authenticated;
grant execute on function public.ensure_scanplay_profile() to authenticated;


-- ============================================================
-- FIN — Vérifications rapides (optionnel) :
--
-- select * from public.get_my_wallet();
-- select * from public.list_recent_coin_transfers(10);
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- SOURCE: patch-shop-wallet-v2.sql
-- ═══════════════════════════════════════════════════════════

-- ============================================================
-- ScanPlay — Boutique v2 (bouclier série, synthèse, scan bonus)
-- Exécuter dans Supabase → SQL Editor → Run
--
-- PRÉREQUIS :
--   • sync-cloud-complete.sql  OU  fix-auth-complete.sql
--   • migration-scan-coins-system.sql  (scanplay_wallets + transferts)
--
-- PAS DE NOUVELLE TABLE :
--   Shop, coffre, potions, bouclier série, crédits synthèse, scans bonus
--   → stockés dans scanplay_user_stats.data.wallet (JSON)
--   Quota synthèse mensuel (used/month) → data.synthesisMonth (JSON)
--
-- Schéma wallet complet (app localStorage = scanplay-wallet) :
-- {
--   "coins": 100,
--   "xpBoostUntil": null,              -- timestamp ms ou null
--   "lastDailyChest": "2026-05-30",    -- date ISO jour coffre
--   "lastAdRewardDate": "2026-05-30",
--   "adWatchesToday": 0,
--   "lostStreak": 0,
--   "lostStreakAt": null,            -- timestamp ms perte série
--   "extraScansDate": null,          -- date ISO jour (scans bonus Free)
--   "extraScansBought": 0,           -- 0–2 par jour
--   "synthesisBonusCredits": 0,      -- crédits IA achetés en shop
--   "streakFreezeCharges": 0         -- boucliers série (max 3)
-- }
--
-- Schéma synthesisMonth (localStorage = scanplay-synthesis-month) :
-- { "month": "2026-05", "used": 2 }
-- ============================================================


-- 1. NORMALISATION JSON WALLET
-- ------------------------------------------------------------

create or replace function public.normalize_scanplay_wallet(p_wallet jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  w jsonb := coalesce(p_wallet, '{}'::jsonb);
  today text := to_char(now() at time zone 'utc', 'YYYY-MM-DD');
begin
  -- Reset scans bonus si jour différent
  if coalesce(w ->> 'extraScansDate', '') is distinct from today then
    w := w || jsonb_build_object('extraScansDate', today, 'extraScansBought', 0);
  end if;

  return jsonb_build_object(
    'coins', greatest(0, least(999999, coalesce((w ->> 'coins')::int, 100))),
    'xpBoostUntil', case
      when w ->> 'xpBoostUntil' is null or w ->> 'xpBoostUntil' = 'null' then null
      else (w ->> 'xpBoostUntil')::bigint
    end,
    'lastDailyChest', w ->> 'lastDailyChest',
    'lastAdRewardDate', w ->> 'lastAdRewardDate',
    'adWatchesToday', greatest(0, least(99, coalesce((w ->> 'adWatchesToday')::int, 0))),
    'lostStreak', greatest(0, coalesce((w ->> 'lostStreak')::int, 0)),
    'lostStreakAt', case
      when w ->> 'lostStreakAt' is null or w ->> 'lostStreakAt' = 'null' then null
      else (w ->> 'lostStreakAt')::bigint
    end,
    'extraScansDate', coalesce(w ->> 'extraScansDate', today),
    'extraScansBought', greatest(0, least(2, coalesce((w ->> 'extraScansBought')::int, 0))),
    'synthesisBonusCredits', greatest(0, least(99, coalesce((w ->> 'synthesisBonusCredits')::int, 0))),
    'streakFreezeCharges', greatest(0, least(3, coalesce((w ->> 'streakFreezeCharges')::int, 0)))
  );
end;
$$;

comment on function public.normalize_scanplay_wallet(jsonb) is
  'Fusionne un blob wallet avec les valeurs par défaut ScanPlay boutique v2.';


-- 2. NORMALISATION QUOTA SYNTHÈSE MENSUEL
-- ------------------------------------------------------------

create or replace function public.normalize_synthesis_month(p_blob jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  b jsonb := coalesce(p_blob, '{}'::jsonb);
  current_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
  if coalesce(b ->> 'month', '') is distinct from current_month then
    return jsonb_build_object('month', current_month, 'used', 0);
  end if;

  return jsonb_build_object(
    'month', current_month,
    'used', greatest(0, least(999, coalesce((b ->> 'used')::int, 0)))
  );
end;
$$;

comment on function public.normalize_synthesis_month(jsonb) is
  'Quota synthèse IA consommé ce mois (hors crédits bonus wallet).';


-- 3. MIGRATION DES DONNÉES EXISTANTES
-- ------------------------------------------------------------

update public.scanplay_user_stats s
set
  data = jsonb_set(
    jsonb_set(
      coalesce(s.data, '{}'::jsonb),
      '{wallet}',
      public.normalize_scanplay_wallet(coalesce(s.data -> 'wallet', '{}'::jsonb))
    ),
    '{synthesisMonth}',
    public.normalize_synthesis_month(coalesce(s.data -> 'synthesisMonth', '{}'::jsonb))
  ),
  updated_at = now()
where true;


-- 4. ALIGNER scanplay_wallets.coins SUR LE BLOB (max des deux)
-- ------------------------------------------------------------

insert into public.scanplay_wallets (user_id, coins)
select
  s.user_id,
  greatest(
    100,
    coalesce((public.normalize_scanplay_wallet(s.data -> 'wallet') ->> 'coins')::int, 100)
  )
from public.scanplay_user_stats s
where not exists (
  select 1 from public.scanplay_wallets w where w.user_id = s.user_id
);

update public.scanplay_wallets w
set
  coins = greatest(
    w.coins,
    coalesce((public.normalize_scanplay_wallet(s.data -> 'wallet') ->> 'coins')::int, 100)
  ),
  updated_at = now()
from public.scanplay_user_stats s
where s.user_id = w.user_id
  and coalesce((public.normalize_scanplay_wallet(s.data -> 'wallet') ->> 'coins')::int, 100) > w.coins;


-- 5. METTRE À JOUR ensure_scanplay_wallet (lit le blob normalisé)
-- ------------------------------------------------------------

create or replace function public.ensure_scanplay_wallet(p_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins int := 100;
  v_wallet jsonb;
begin
  if p_user_id is null then
    return;
  end if;

  select public.normalize_scanplay_wallet(coalesce(s.data -> 'wallet', '{}'::jsonb))
  into v_wallet
  from public.scanplay_user_stats s
  where s.user_id = p_user_id;

  v_coins := greatest(100, coalesce((v_wallet ->> 'coins')::int, 100));

  insert into public.scanplay_wallets (user_id, coins)
  values (p_user_id, v_coins)
  on conflict (user_id) do update
  set
    coins = greatest(scanplay_wallets.coins, excluded.coins),
    updated_at = now();
end;
$$;


-- 6. RPC : lire le wallet normalisé (debug / futur client)
-- ------------------------------------------------------------

create or replace function public.get_my_wallet_blob()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(s.data, '{}'::jsonb)
  into v_data
  from public.scanplay_user_stats s
  where s.user_id = auth.uid();

  return jsonb_build_object(
    'wallet', public.normalize_scanplay_wallet(v_data -> 'wallet'),
    'synthesisMonth', public.normalize_synthesis_month(v_data -> 'synthesisMonth')
  );
end;
$$;

comment on function public.get_my_wallet_blob() is
  'Retourne wallet + synthesisMonth normalisés pour l''utilisateur connecté.';


-- 7. RPC : fusionner un push wallet depuis l''app (optionnel, sync cloud)
-- ------------------------------------------------------------

create or replace function public.merge_wallet_blob(p_wallet jsonb, p_synthesis_month jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_data jsonb;
  v_wallet jsonb;
  v_coins int;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;

  v_wallet := public.normalize_scanplay_wallet(p_wallet);

  insert into public.scanplay_user_stats (user_id, data)
  values (v_me, '{}'::jsonb)
  on conflict (user_id) do nothing;

  select coalesce(data, '{}'::jsonb) into v_data
  from public.scanplay_user_stats
  where user_id = v_me;

  v_data := jsonb_set(v_data, '{wallet}', v_wallet);

  if p_synthesis_month is not null then
    v_data := jsonb_set(
      v_data,
      '{synthesisMonth}',
      public.normalize_synthesis_month(p_synthesis_month)
    );
  end if;

  update public.scanplay_user_stats
  set data = v_data, updated_at = now()
  where user_id = v_me;

  v_coins := (v_wallet ->> 'coins')::int;
  perform public.sync_wallet_coins(v_coins);

  return jsonb_build_object(
    'wallet', v_wallet,
    'synthesisMonth', public.normalize_synthesis_month(v_data -> 'synthesisMonth')
  );
end;
$$;

comment on function public.merge_wallet_blob(jsonb, jsonb) is
  'Fusionne le blob wallet/synthesisMonth poussé par l''app (sync boutique).';


-- 8. DROITS
-- ------------------------------------------------------------

grant execute on function public.normalize_scanplay_wallet(jsonb) to authenticated;
grant execute on function public.normalize_synthesis_month(jsonb) to authenticated;
grant execute on function public.get_my_wallet_blob() to authenticated;
grant execute on function public.merge_wallet_blob(jsonb, jsonb) to authenticated;


-- 9. VÉRIFICATION
-- ------------------------------------------------------------
-- select public.normalize_scanplay_wallet('{"coins":50}'::jsonb);
-- select * from public.get_my_wallet_blob();
-- select user_id, data -> 'wallet', data -> 'synthesisMonth'
-- from public.scanplay_user_stats limit 5;

-- ============================================================
-- PRODUCTION AUTH (scanplay.org + Resend SMTP)
-- Dashboard AVANT test inscription :
--   Authentication → SMTP (smtp.resend.com, resend, re_...)
--   Providers → Email → Confirm email ON
--   URL Configuration → https://scanplay.org + https://scanplay.org/**
-- ============================================================

drop trigger if exists on_scanplay_auto_confirm on auth.users;
drop function if exists public.auto_confirm_scanplay_user();

-- ============================================================
-- FIN — Vérification rapide
-- ============================================================

select 'tables' as kind, count(*)::text as n
from pg_tables
where schemaname = 'public' and tablename like 'scanplay_%'
union all
select 'functions' as kind, count(*)::text as n
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname like '%scanplay%'
    or p.proname in (
      'ensure_scanplay_profile', 'search_players', 'list_my_friends', 'send_friend_request',
      'sync_public_profile_stats', 'transfer_coins_to_friend', 'create_path_room'
    )
  );
