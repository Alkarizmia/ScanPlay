-- ============================================================
-- ScanPlay — Pseudos uniques + recherche amis fiable
-- Exécuter dans Supabase → SQL Editor (après migrations social)
-- ============================================================

-- 1. Backfill profils publics depuis le blob stats (nom local cloud)
-- ------------------------------------------------------------
insert into public.scanplay_public_profiles (user_id, display_name, avatar_id, level, xp, streak, updated_at)
select
  u.id,
  left(
    trim(
      coalesce(
        nullif(s.data -> 'profile' ->> 'displayName', ''),
        nullif(pp.display_name, ''),
        'ID-' || lpad((abs(hashtext(replace(u.id::text, '-', ''))) % 10000)::text, 4, '0')
      )
    ),
    24
  ) as display_name,
  coalesce(
    nullif(s.data -> 'profile' ->> 'avatar', ''),
    nullif(pp.avatar_id, ''),
    'avatar1'
  ) as avatar_id,
  greatest(
    1,
    coalesce(
      pp.level,
      floor(sqrt(greatest(0, coalesce((s.data ->> 'xp')::int, pp.xp, 0))::float / 50)) + 1
    )::int
  ) as level,
  greatest(0, coalesce((s.data ->> 'xp')::int, pp.xp, 0)) as xp,
  greatest(0, coalesce((s.data ->> 'streak')::int, pp.streak, 0)) as streak,
  now() as updated_at
from auth.users u
left join public.scanplay_user_stats s on s.user_id = u.id
left join public.scanplay_public_profiles pp on pp.user_id = u.id
where coalesce(nullif(trim(s.data -> 'profile' ->> 'displayName'), ''), nullif(trim(pp.display_name), '')) is not null
on conflict (user_id) do update set
  display_name = excluded.display_name,
  avatar_id = excluded.avatar_id,
  level = excluded.level,
  xp = excluded.xp,
  streak = excluded.streak,
  updated_at = now();


-- 2. Résoudre les doublons existants (suffixe court user_id)
-- ------------------------------------------------------------
with ranked as (
  select
    user_id,
    display_name,
    row_number() over (
      partition by lower(trim(display_name))
      order by updated_at asc nulls last, user_id
    ) as rn
  from public.scanplay_public_profiles
)
update public.scanplay_public_profiles p
set display_name = left(r.display_name, 18) || '-' || substr(replace(r.user_id::text, '-', ''), 1, 4)
from ranked r
where p.user_id = r.user_id
  and r.rn > 1;


-- 3. Index unique (insensible à la casse)
-- ------------------------------------------------------------
drop index if exists public.scanplay_public_profiles_name_idx;
create unique index if not exists scanplay_public_profiles_name_unique_idx
  on public.scanplay_public_profiles (lower(trim(display_name)));


-- 4. Vérifier disponibilité d'un pseudo
-- ------------------------------------------------------------
create or replace function public.check_display_name_available(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.scanplay_public_profiles p
    where lower(trim(p.display_name)) = lower(left(trim(coalesce(p_name, '')), 24))
      and (auth.uid() is null or p.user_id <> auth.uid())
  )
  and char_length(trim(coalesce(p_name, ''))) >= 2;
$$;

comment on function public.check_display_name_available(text) is
  'true si le pseudo est libre (≥2 car., casse ignorée)';


-- 5. Sync profil public — refuse les pseudos déjà pris
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
  v_name text := left(trim(coalesce(p_display_name, 'Joueur')), 24);
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

  insert into public.scanplay_public_profiles (
    user_id, display_name, avatar_id, level, xp, streak, deck_count, plan, updated_at
  )
  values (
    auth.uid(),
    v_name,
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


-- 6. Recherche amis — correspondance exacte prioritaire
-- ------------------------------------------------------------
drop function if exists public.search_players(text);

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

grant execute on function public.check_display_name_available(text) to authenticated;
grant execute on function public.sync_public_profile_stats(text, text, int, int, int, text) to authenticated;
grant execute on function public.search_players(text) to authenticated;
