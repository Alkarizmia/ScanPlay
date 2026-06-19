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
