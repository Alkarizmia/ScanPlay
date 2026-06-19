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
