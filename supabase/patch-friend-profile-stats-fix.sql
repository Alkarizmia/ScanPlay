-- ============================================================
-- ScanPlay — Profil ami : stats + succès persistants (hors ligne OK)
-- Exécuter dans Supabase → SQL Editor → Run
-- ============================================================


-- 1. touch_presence : ne crée plus un profil vide « Joueur »
-- ------------------------------------------------------------
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


-- 2. Sync succès : ne réinitialise plus le reste du profil
-- ------------------------------------------------------------
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

  insert into public.scanplay_public_profiles (user_id, display_name, avatar_id, achievement_unlocks)
  values (v_uid, 'Joueur', 'avatar1', v_clean)
  on conflict (user_id) do update set
    achievement_unlocks = excluded.achievement_unlocks,
    updated_at = now();
end;
$$;


-- 3. Fusion succès (profil public + blob cloud)
-- ------------------------------------------------------------
create or replace function public.merge_achievement_unlocks(p_public jsonb, p_stats jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'unlockedAt', unlocked_at
      )
      order by unlocked_at desc
    ),
    '[]'::jsonb
  )
  from (
    select distinct on (id)
      id,
      unlocked_at
    from (
      select
        nullif(trim(elem ->> 'id'), '') as id,
        coalesce(
          nullif(trim(elem ->> 'unlockedAt'), ''),
          nullif(trim(elem ->> 'unlocked_at'), ''),
          '1970-01-01T00:00:00Z'
        ) as unlocked_at
      from jsonb_array_elements(coalesce(p_public, '[]'::jsonb)) elem
      union all
      select
        nullif(trim(elem ->> 'id'), ''),
        coalesce(
          nullif(trim(elem ->> 'unlockedAt'), ''),
          nullif(trim(elem ->> 'unlocked_at'), ''),
          '1970-01-01T00:00:00Z'
        )
      from jsonb_array_elements(coalesce(p_stats, '[]'::jsonb)) elem
    ) raw
    where id is not null
    order by id, unlocked_at desc
  ) deduped;
$$;


-- 4. Liste amis — dernières stats connues (même hors ligne)
-- ------------------------------------------------------------
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
    case
      when nullif(trim(p.display_name), '') is not null
        and lower(trim(p.display_name)) not in ('joueur', 'player')
        then left(trim(p.display_name), 24)
      else left(
        trim(
          coalesce(
            nullif(trim(s.data -> 'profile' ->> 'displayName'), ''),
            nullif(trim(p.display_name), ''),
            'Joueur'
          )
        ),
        24
      )
    end as display_name,
    coalesce(nullif(p.avatar_id, ''), nullif(s.data -> 'profile' ->> 'avatar', ''), 'avatar1') as avatar_id,
    coalesce(
      p.avatar_url,
      case
        when coalesce(nullif(p.avatar_id, ''), s.data -> 'profile' ->> 'avatar') = 'custom'
          then nullif(trim(s.data -> 'profile' ->> 'customAvatarData'), '')
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
    coalesce(
      jsonb_array_length(public.merge_achievement_unlocks(p.achievement_unlocks, s.data -> 'achievementUnlocks')),
      0
    )::int as achievement_count,
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
    coalesce(
      jsonb_array_length(public.merge_achievement_unlocks(p.achievement_unlocks, s.data -> 'achievementUnlocks')),
      0
    ) desc
  limit 100;
$$;


-- 5. Profil ami détaillé
-- ------------------------------------------------------------
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

  v_name := case
    when v_profile.user_id is not null
      and nullif(trim(v_profile.display_name), '') is not null
      and lower(trim(v_profile.display_name)) not in ('joueur', 'player')
      then left(trim(v_profile.display_name), 24)
    else left(
      trim(
        coalesce(
          nullif(v_stats -> 'profile' ->> 'displayName', ''),
          nullif(v_profile.display_name, ''),
          'Joueur'
        )
      ),
      24
    )
  end;

  v_xp := greatest(coalesce(v_profile.xp, 0), coalesce(v_sp.xp, 0));
  v_streak := greatest(coalesce(v_profile.streak, 0), coalesce(v_sp.streak, 0));
  v_unlocks := public.merge_achievement_unlocks(
    coalesce(v_profile.achievement_unlocks, '[]'::jsonb),
    coalesce(v_stats -> 'achievementUnlocks', '[]'::jsonb)
  );
  v_count := coalesce(jsonb_array_length(v_unlocks), 0);

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
          then nullif(trim(v_stats -> 'profile' ->> 'customAvatarData'), '')
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


-- 6. Backfill profils publics depuis le cloud
-- ------------------------------------------------------------
update public.scanplay_public_profiles p
set
  display_name = left(
    trim(
      coalesce(
        nullif(trim(p.display_name), ''),
        nullif(s.data -> 'profile' ->> 'displayName', ''),
        p.display_name
      )
    ),
    24
  ),
  xp = greatest(coalesce(p.xp, 0), coalesce(sp.xp, 0)),
  streak = greatest(coalesce(p.streak, 0), coalesce(sp.streak, 0)),
  achievement_unlocks = public.merge_achievement_unlocks(
    p.achievement_unlocks,
    s.data -> 'achievementUnlocks'
  ),
  avatar_url = coalesce(
    p.avatar_url,
    case
      when coalesce(p.avatar_id, s.data -> 'profile' ->> 'avatar') = 'custom'
        then nullif(left(trim(s.data -> 'profile' ->> 'customAvatarData'), 200000), '')
      else null
    end
  ),
  updated_at = now()
from public.scanplay_user_stats s
left join public.scanplay_profiles sp on sp.user_id = s.user_id
where s.user_id = p.user_id;


grant execute on function public.touch_presence() to authenticated;
grant execute on function public.sync_public_achievement_unlocks(jsonb) to authenticated;
grant execute on function public.merge_achievement_unlocks(jsonb, jsonb) to authenticated;
grant execute on function public.list_my_friends() to authenticated;
grant execute on function public.get_friend_profile(uuid) to authenticated;
