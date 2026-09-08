-- ============================================================
-- ScanPlay : mini-coach (chat) + quotas journaliers
-- À coller dans Supabase → SQL Editor → Run
--
-- Quotas (Europe/Paris) :
--   Free 3 messages / jour, 150 caractères, 2 dernières fiches
--   Plus 15 messages / jour, 200 caractères, 4 dernières fiches
--   Pro  40 messages / jour, 250 caractères, 7 dernières fiches
-- Mode vocal : Groq Whisper (GROQ_API_KEY sur Vercel, /api/transcribe)
--
-- Script idempotent (safe à relancer).
-- Ensuite : supabase functions deploy coach-chat
-- ============================================================

create table if not exists public.scanplay_coach_plan_limits (
  plan text primary key check (plan in ('free', 'plus', 'pro')),
  messages_per_day int not null,
  max_chars int not null,
  history_window int not null,
  voice_enabled boolean not null default true,
  voice_provider text not null default 'groq'
);

comment on table public.scanplay_coach_plan_limits is
  'Limites coach par plan. voice_provider = groq (Whisper via /api/transcribe).';

insert into public.scanplay_coach_plan_limits
  (plan, messages_per_day, max_chars, history_window, voice_enabled, voice_provider)
values
  ('free', 3, 150, 2, true, 'groq'),
  ('plus', 15, 200, 4, true, 'groq'),
  ('pro', 40, 250, 7, true, 'groq')
on conflict (plan) do update set
  messages_per_day = excluded.messages_per_day,
  max_chars = excluded.max_chars,
  history_window = excluded.history_window,
  voice_enabled = excluded.voice_enabled,
  voice_provider = excluded.voice_provider;

alter table public.scanplay_coach_plan_limits enable row level security;

drop policy if exists "scanplay_coach_plan_limits_read" on public.scanplay_coach_plan_limits;
create policy "scanplay_coach_plan_limits_read"
  on public.scanplay_coach_plan_limits for select
  using (true);

create table if not exists public.scanplay_coach_chat_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  message_count int not null default 0 check (message_count >= 0),
  primary key (user_id, day)
);

comment on table public.scanplay_coach_chat_usage is
  'Compteur journalier de messages envoyés au mini-coach.';

create table if not exists public.scanplay_coach_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

comment on table public.scanplay_coach_chat_messages is
  'Historique du mini-coach. Conservé côté serveur, visible uniquement par le propriétaire.';

create index if not exists scanplay_coach_chat_messages_user_created_idx
  on public.scanplay_coach_chat_messages (user_id, created_at desc);

alter table public.scanplay_coach_chat_usage enable row level security;
alter table public.scanplay_coach_chat_messages enable row level security;

drop policy if exists "scanplay_coach_chat_usage_select_own" on public.scanplay_coach_chat_usage;
create policy "scanplay_coach_chat_usage_select_own"
  on public.scanplay_coach_chat_usage for select
  using (auth.uid() = user_id);

drop policy if exists "scanplay_coach_chat_messages_select_own" on public.scanplay_coach_chat_messages;
create policy "scanplay_coach_chat_messages_select_own"
  on public.scanplay_coach_chat_messages for select
  using (auth.uid() = user_id);

drop policy if exists "scanplay_coach_chat_messages_insert_own_user" on public.scanplay_coach_chat_messages;
create policy "scanplay_coach_chat_messages_insert_own_user"
  on public.scanplay_coach_chat_messages for insert
  with check (auth.uid() = user_id and role = 'user');

drop policy if exists "scanplay_coach_chat_messages_delete_own" on public.scanplay_coach_chat_messages;
create policy "scanplay_coach_chat_messages_delete_own"
  on public.scanplay_coach_chat_messages for delete
  using (auth.uid() = user_id);

create or replace function public.coach_chat_daily_limit(p_plan text)
returns int
language sql
stable
as $$
  select coalesce(
    (select messages_per_day from public.scanplay_coach_plan_limits where plan = coalesce(p_plan, 'free')),
    3
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
    when p_plan in ('free', 'plus', 'pro') then p_plan
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
  max_chars int := 150;
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

  if plan is null or plan not in ('free', 'plus', 'pro') then
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
    'maxChars', coalesce(max_chars, 150),
    'historyWindow', coalesce(history_window, 2),
    'voiceEnabled', coalesce(voice_enabled, true),
    'voiceProvider', coalesce(voice_provider, 'groq')
  );
end;
$$;

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
  max_chars int := 150;
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

  if plan is null or plan not in ('free', 'plus', 'pro') then
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
    'maxChars', coalesce(max_chars, 150),
    'historyWindow', coalesce(history_window, 2),
    'voiceEnabled', coalesce(voice_enabled, true),
    'voiceProvider', coalesce(voice_provider, 'groq')
  );
end;
$$;

create or replace function public.refund_coach_chat_credit()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (timezone('Europe/Paris', now()))::date;
begin
  if uid is null then
    return;
  end if;

  update public.scanplay_coach_chat_usage
  set message_count = greatest(message_count - 1, 0)
  where user_id = uid and day = today;
end;
$$;

grant execute on function public.coach_chat_daily_limit(text) to authenticated;
grant execute on function public.coach_chat_plan_caps(text) to authenticated;
grant execute on function public.get_coach_chat_quota() to authenticated;
grant execute on function public.consume_coach_chat_credit() to authenticated;
grant execute on function public.refund_coach_chat_credit() to authenticated;
