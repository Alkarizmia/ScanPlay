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
