-- ScanPlay: remove hard coach daily caps; AI token envelope is the ceiling.
-- Free coach enabled; soft max_chars raised. Run in Supabase SQL Editor.

-- Ensure Max plan row exists (older DBs only had free/plus/pro).
alter table public.scanplay_coach_plan_limits
  drop constraint if exists scanplay_coach_plan_limits_plan_check;

alter table public.scanplay_coach_plan_limits
  add constraint scanplay_coach_plan_limits_plan_check
  check (plan in ('free', 'plus', 'pro', 'max'));

insert into public.scanplay_coach_plan_limits
  (plan, messages_per_day, max_chars, history_window, voice_enabled, voice_provider)
values
  ('free', 9999, 4000, 7, true, 'groq'),
  ('plus', 9999, 4000, 15, true, 'groq'),
  ('pro', 9999, 4000, 25, true, 'groq'),
  ('max', 9999, 4000, 40, true, 'groq')
on conflict (plan) do update set
  messages_per_day = excluded.messages_per_day,
  max_chars = excluded.max_chars,
  history_window = excluded.history_window,
  voice_enabled = excluded.voice_enabled,
  voice_provider = excluded.voice_provider;

create or replace function public.coach_chat_daily_limit(p_plan text)
returns int
language sql
stable
as $$
  select coalesce(
    (select messages_per_day from public.scanplay_coach_plan_limits where plan = coalesce(p_plan, 'free')),
    9999
  );
$$;

create or replace function public.coach_chat_plan_caps(p_plan text)
returns table (
  messages_per_day int,
  max_chars int,
  history_window int,
  voice_enabled boolean,
  voice_provider text
)
language sql
stable
as $$
  select
    l.messages_per_day,
    l.max_chars,
    l.history_window,
    l.voice_enabled,
    l.voice_provider
  from public.scanplay_coach_plan_limits l
  where l.plan = case
    when p_plan in ('free', 'plus', 'pro', 'max') then p_plan
    else 'free'
  end;
$$;

create or replace function public.get_coach_chat_quota()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (timezone('Europe/Paris', now()))::date;
  plan text := 'free';
  lim int;
  used int := 0;
  max_chars int := 4000;
  history_window int := 2;
  voice_enabled boolean := true;
  voice_provider text := 'groq';
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select coalesce(p.plan, 'free') into plan
  from public.scanplay_profiles p
  where p.user_id = uid;

  if plan is null or plan not in ('free', 'plus', 'pro', 'max') then
    plan := 'free';
  end if;

  lim := public.coach_chat_daily_limit(plan);

  select c.max_chars, c.history_window, c.voice_enabled, c.voice_provider
  into max_chars, history_window, voice_enabled, voice_provider
  from public.coach_chat_plan_caps(plan) c;

  used := coalesce((
    select u.message_count
    from public.scanplay_coach_chat_usage u
    where u.user_id = uid and u.day = today
  ), 0);

  return jsonb_build_object(
    'ok', true,
    'plan', plan,
    'used', used,
    'limit', lim,
    'remaining', greatest(lim - used, 0),
    'maxChars', coalesce(max_chars, 4000),
    'historyWindow', coalesce(history_window, 2),
    'voiceEnabled', coalesce(voice_enabled, true),
    'voiceProvider', coalesce(voice_provider, 'groq')
  );
end;
$$;

-- consume_coach_chat_credit: recognize Max + soft daily ceiling (AI envelope is the real gate).
create or replace function public.consume_coach_chat_credit()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (timezone('Europe/Paris', now()))::date;
  plan text := 'free';
  lim int;
  used int;
  max_chars int := 4000;
  history_window int := 2;
  voice_enabled boolean := true;
  voice_provider text := 'groq';
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select coalesce(p.plan, 'free') into plan
  from public.scanplay_profiles p
  where p.user_id = uid;

  if plan is null or plan not in ('free', 'plus', 'pro', 'max') then
    plan := 'free';
  end if;

  lim := public.coach_chat_daily_limit(plan);

  insert into public.scanplay_coach_chat_usage (user_id, day, message_count)
  values (uid, today, 1)
  on conflict (user_id, day)
  do update set message_count = public.scanplay_coach_chat_usage.message_count + 1
  where public.scanplay_coach_chat_usage.message_count < lim
  returning message_count into used;

  if used is null then
    select message_count into used
    from public.scanplay_coach_chat_usage
    where user_id = uid and day = today;

    return jsonb_build_object(
      'ok', false,
      'error', 'quota_exceeded',
      'plan', plan,
      'used', coalesce(used, lim),
      'limit', lim,
      'remaining', 0
    );
  end if;

  select c.max_chars, c.history_window, c.voice_enabled, c.voice_provider
  into max_chars, history_window, voice_enabled, voice_provider
  from public.coach_chat_plan_caps(plan) c;

  return jsonb_build_object(
    'ok', true,
    'plan', plan,
    'used', used,
    'limit', lim,
    'remaining', greatest(lim - used, 0),
    'maxChars', coalesce(max_chars, 4000),
    'historyWindow', coalesce(history_window, 2),
    'voiceEnabled', coalesce(voice_enabled, true),
    'voiceProvider', coalesce(voice_provider, 'groq')
  );
end;
$$;
