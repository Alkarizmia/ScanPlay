-- ============================================================
-- ScanPlay — Autoriser les fonds boutique (slate, nightforest, …)
-- dans sync_public_profile_stats (sinon → forcé à green)
-- Exécuter dans Supabase → SQL Editor → Run
-- ============================================================

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

-- Backfill fonds boutique depuis le blob stats
update public.scanplay_public_profiles p
set banner_theme = nullif(trim(s.data -> 'profile' ->> 'bannerTheme'), '')
from public.scanplay_user_stats s
where s.user_id = p.user_id
  and nullif(trim(s.data -> 'profile' ->> 'bannerTheme'), '') is not null
  and nullif(trim(s.data -> 'profile' ->> 'bannerTheme'), '') in (
    'slate', 'blush', 'nightforest', 'reef', 'stars', 'waves', 'comet', 'ember',
    'northern', 'lava', 'nebula', 'galaxy', 'blackhole', 'void'
  );
