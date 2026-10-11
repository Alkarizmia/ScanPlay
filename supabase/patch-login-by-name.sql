-- ============================================================
-- ScanPlay — Connexion par nom (2–5 car.) OU email
-- Supabase → SQL Editor → Run
-- ============================================================

-- Lookup email from public display_name (security definer; email never exposed in SELECT grants).
create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id text := lower(trim(coalesce(p_identifier, '')));
  v_email text;
begin
  if auth.uid() is not null then
    -- Not needed when already logged in
    null;
  end if;

  if v_id = '' or char_length(v_id) < 2 or char_length(v_id) > 5 then
    return null;
  end if;

  -- Exact match on display_name (case-insensitive), then email from auth.users
  select u.email into v_email
  from public.scanplay_public_profiles p
  join auth.users u on u.id = p.user_id
  where lower(trim(p.display_name)) = v_id
  limit 1;

  return v_email;
end;
$$;

-- Allow anonymous + authenticated clients to resolve (needed before login).
grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- Availability check usable at signup (anon) — length 2–5.
create or replace function public.check_display_name_available(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    char_length(trim(coalesce(p_name, ''))) between 2 and 5
    and not exists (
      select 1
      from public.scanplay_public_profiles p
      where lower(trim(p.display_name)) = lower(left(trim(coalesce(p_name, '')), 5))
        and (auth.uid() is null or p.user_id <> auth.uid())
    );
$$;

grant execute on function public.check_display_name_available(text) to anon, authenticated;

-- Tighten display_name length on public sync (2–5).
create or replace function public.sync_public_profile_stats(
  p_display_name text,
  p_avatar_id text,
  p_xp int,
  p_streak int,
  p_deck_count int,
  p_plan text default 'free',
  p_avatar_url text default null,
  p_banner_theme text default 'green'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := coalesce(nullif(trim(p_plan), ''), 'free');
  v_name text := left(trim(coalesce(p_display_name, '')), 5);
  v_avatar text := coalesce(nullif(p_avatar_id, ''), 'avatar1');
  v_url text;
  v_banner text := coalesce(nullif(trim(p_banner_theme), ''), 'green');
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

  if v_banner not in ('green', 'red', 'blue', 'yellow', 'aurora', 'ocean', 'sunset', 'prism', 'neon') then
    v_banner := 'green';
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
      user_id, display_name, avatar_id, avatar_url, level, xp, streak, deck_count, plan, banner_theme, updated_at
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
      updated_at = now();
  exception
    when unique_violation then
      raise exception 'display_name_taken';
  end;
end;
$$;

grant execute on function public.sync_public_profile_stats(text, text, int, int, int, text, text, text) to authenticated;
