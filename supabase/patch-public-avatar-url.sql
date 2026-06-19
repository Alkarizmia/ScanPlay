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
