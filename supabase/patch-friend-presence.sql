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
