-- ============================================================
-- ScanPlay — Anneau avatar (cadre photo) visible en recherche / profil ami
-- Exécuter dans Supabase → SQL Editor → Run
-- ============================================================

alter table public.scanplay_public_profiles
  add column if not exists avatar_frame text;

comment on column public.scanplay_public_profiles.avatar_frame is
  'Anneau autour de la photo (ex. frame_gold). Null = aucun.';

-- Backfill depuis le blob stats local déjà syncé
update public.scanplay_public_profiles p
set avatar_frame = nullif(trim(s.data -> 'profile' ->> 'avatarFrame'), '')
from public.scanplay_user_stats s
where s.user_id = p.user_id
  and (
    p.avatar_frame is null
    or p.avatar_frame = ''
  )
  and nullif(trim(s.data -> 'profile' ->> 'avatarFrame'), '') is not null;


drop function if exists public.sync_public_profile_stats(text, text, int, int, int);
drop function if exists public.sync_public_profile_stats(text, text, int, int, int, text);
drop function if exists public.sync_public_profile_stats(text, text, int, int, int, text, text);
drop function if exists public.sync_public_profile_stats(text, text, int, int, int, text, text, text);
drop function if exists public.sync_public_profile_stats(text, text, int, int, int, text, text, text, text);

create or replace function public.sync_public_profile_stats(
  p_display_name text,
  p_avatar_id text,
  p_xp int,
  p_streak int,
  p_deck_count int,
  p_plan text default 'free',
  p_avatar_url text default null,
  p_banner_theme text default 'green',
  p_avatar_frame text default null
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
  v_banner text := coalesce(nullif(trim(p_banner_theme), ''), 'green');
  v_frame text := nullif(trim(coalesce(p_avatar_frame, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if char_length(v_name) < 2 then
    raise exception 'display_name_invalid';
  end if;

  if v_plan not in ('free', 'plus', 'pro', 'max') then
    v_plan := 'free';
  end if;

  -- Fonds plan + shop (ids catalogue: slate, nightforest, …)
  if v_banner not in (
    'green', 'red', 'blue', 'yellow', 'aurora', 'ocean', 'sunset', 'prism', 'neon',
    'slate', 'blush', 'nightforest', 'reef', 'stars', 'waves', 'comet', 'ember',
    'northern', 'lava', 'nebula', 'galaxy', 'blackhole', 'void'
  ) and v_banner not like 'banner_%' then
    v_banner := 'green';
  end if;

  if v_frame is not null and v_frame not in (
    'frame_white', 'frame_gold', 'frame_neon', 'frame_space', 'frame_reef',
    'frame_rainbow', 'frame_lava', 'frame_orbit', 'frame_flames', 'frame_sparks'
  ) then
    v_frame := null;
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
      user_id, display_name, avatar_id, avatar_url, level, xp, streak, deck_count,
      plan, banner_theme, avatar_frame, updated_at
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
      v_banner,
      v_frame,
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
      banner_theme = excluded.banner_theme,
      avatar_frame = excluded.avatar_frame,
      updated_at = now();
  exception
    when unique_violation then
      raise exception 'display_name_taken';
  end;
end;
$$;


drop function if exists public.search_players(text);

create or replace function public.search_players(p_query text)
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  avatar_url text,
  level int,
  friend_status text,
  plan text,
  banner_theme text,
  avatar_frame text,
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
    end as friend_status,
    coalesce(p.plan, 'free') as plan,
    coalesce(p.banner_theme, 'green') as banner_theme,
    nullif(p.avatar_frame, '') as avatar_frame,
    p.last_seen_at
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
  last_seen_at timestamptz,
  plan text,
  banner_theme text,
  avatar_frame text
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
    p.last_seen_at,
    coalesce(sp.plan, p.plan, 'free') as plan,
    coalesce(
      nullif(p.banner_theme, ''),
      nullif(s.data -> 'profile' ->> 'bannerTheme', ''),
      'green'
    ) as banner_theme,
    coalesce(
      nullif(p.avatar_frame, ''),
      nullif(s.data -> 'profile' ->> 'avatarFrame', '')
    ) as avatar_frame
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
  v_banner text;
  v_frame text;
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
  if v_plan is null or v_plan not in ('free', 'plus', 'pro', 'max') then
    v_plan := coalesce(v_profile.plan, 'free');
  end if;

  v_banner := coalesce(
    nullif(v_profile.banner_theme, ''),
    nullif(v_stats -> 'profile' ->> 'bannerTheme', ''),
    'green'
  );

  v_frame := coalesce(
    nullif(v_profile.avatar_frame, ''),
    nullif(v_stats -> 'profile' ->> 'avatarFrame', '')
  );

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
    'banner_theme', v_banner,
    'avatar_frame', v_frame,
    'friend_count', v_friend_count,
    'achievement_unlocks', v_unlocks,
    'achievement_count', v_count
  );
end;
$$;

grant execute on function public.sync_public_profile_stats(text, text, int, int, int, text, text, text, text) to authenticated;
grant execute on function public.search_players(text) to authenticated;
grant execute on function public.list_my_friends() to authenticated;
grant execute on function public.get_friend_profile(uuid) to authenticated;
