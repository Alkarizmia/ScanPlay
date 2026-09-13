-- Pix coach: Free = 0 message / jour (Plus / Pro only).
-- Run in Supabase SQL Editor, then redeploy coach-chat if needed.

update public.scanplay_coach_plan_limits
set
  messages_per_day = 0,
  history_window = 0
where plan = 'free';

create or replace function public.coach_chat_daily_limit(p_plan text)
returns int
language sql
stable
as $$
  select coalesce(
    (select messages_per_day from public.scanplay_coach_plan_limits where plan = coalesce(p_plan, 'free')),
    0
  );
$$;
