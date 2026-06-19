-- ============================================================
-- ScanPlay — Pseudos UNIQUES (fix « Nom déjà pris » non fonctionnel)
-- Exécuter dans Supabase → SQL Editor → Run
--
-- À lancer si deux comptes peuvent encore prendre le même pseudo
-- (ex. « Alkarizmia »). Réapplique l'index unique + les RPC corrigées.
-- ============================================================


-- 1. Résoudre les doublons existants (garde le plus ancien)
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
  where char_length(trim(display_name)) >= 2
)
update public.scanplay_public_profiles p
set
  display_name = left(r.display_name, 18) || '-' || substr(replace(r.user_id::text, '-', ''), 1, 4),
  updated_at = now()
from ranked r
where p.user_id = r.user_id
  and r.rn > 1;


-- 2. Index unique (insensible à la casse et espaces)
-- ------------------------------------------------------------
drop index if exists public.scanplay_public_profiles_name_idx;
drop index if exists public.scanplay_public_profiles_name_unique_idx;
create unique index scanplay_public_profiles_name_unique_idx
  on public.scanplay_public_profiles (lower(trim(display_name)));


-- 3. Vérifier disponibilité
-- ------------------------------------------------------------
create or replace function public.check_display_name_available(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    char_length(trim(coalesce(p_name, ''))) >= 2
    and not exists (
      select 1
      from public.scanplay_public_profiles p
      where lower(trim(p.display_name)) = lower(left(trim(coalesce(p_name, '')), 24))
        and (auth.uid() is null or p.user_id <> auth.uid())
    );
$$;


-- 4. Sync profil public — refuse les pseudos déjà pris
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

  begin
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
  exception
    when unique_violation then
      raise exception 'display_name_taken';
  end;
end;
$$;


-- 5. Recherche amis — correspondance exacte prioritaire
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
