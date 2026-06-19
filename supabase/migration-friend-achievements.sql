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
