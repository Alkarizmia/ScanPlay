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
