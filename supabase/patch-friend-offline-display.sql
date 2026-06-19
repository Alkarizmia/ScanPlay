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
