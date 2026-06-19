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
