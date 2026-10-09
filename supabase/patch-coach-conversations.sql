-- ============================================================
-- ScanPlay : conversations coach (multi-thread + titres)
-- À coller dans Supabase → SQL Editor → Run
-- Puis : supabase functions deploy coach-chat
-- ============================================================

create table if not exists public.scanplay_coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Nouvelle conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.scanplay_coach_conversations is
  'Fils de discussion coach. La mémoire IA reste scoped à une conversation.';

create index if not exists scanplay_coach_conversations_user_updated_idx
  on public.scanplay_coach_conversations (user_id, updated_at desc);

alter table public.scanplay_coach_conversations enable row level security;

drop policy if exists "scanplay_coach_conversations_select_own" on public.scanplay_coach_conversations;
create policy "scanplay_coach_conversations_select_own"
  on public.scanplay_coach_conversations for select
  using (auth.uid() = user_id);

drop policy if exists "scanplay_coach_conversations_insert_own" on public.scanplay_coach_conversations;
create policy "scanplay_coach_conversations_insert_own"
  on public.scanplay_coach_conversations for insert
  with check (auth.uid() = user_id);

drop policy if exists "scanplay_coach_conversations_update_own" on public.scanplay_coach_conversations;
create policy "scanplay_coach_conversations_update_own"
  on public.scanplay_coach_conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "scanplay_coach_conversations_delete_own" on public.scanplay_coach_conversations;
create policy "scanplay_coach_conversations_delete_own"
  on public.scanplay_coach_conversations for delete
  using (auth.uid() = user_id);

-- Messages: conversation_id (nullable for legacy rows)
alter table public.scanplay_coach_chat_messages
  add column if not exists conversation_id uuid references public.scanplay_coach_conversations (id) on delete cascade;

create index if not exists scanplay_coach_chat_messages_conv_created_idx
  on public.scanplay_coach_chat_messages (conversation_id, created_at asc);

-- Backfill: one conversation per user that already has messages
insert into public.scanplay_coach_conversations (user_id, title, created_at, updated_at)
select
  m.user_id,
  left(coalesce((
    select m2.content from public.scanplay_coach_chat_messages m2
    where m2.user_id = m.user_id and m2.role = 'user'
    order by m2.created_at asc
    limit 1
  ), 'Conversation'), 48),
  min(m.created_at),
  max(m.created_at)
from public.scanplay_coach_chat_messages m
where not exists (
  select 1 from public.scanplay_coach_conversations c where c.user_id = m.user_id
)
group by m.user_id;

update public.scanplay_coach_chat_messages msg
set conversation_id = c.id
from public.scanplay_coach_conversations c
where msg.user_id = c.user_id
  and msg.conversation_id is null;

-- Allow the app to persist both user + assistant turns (not only service role)
drop policy if exists "scanplay_coach_chat_messages_insert_own_user" on public.scanplay_coach_chat_messages;
drop policy if exists "scanplay_coach_chat_messages_insert_own" on public.scanplay_coach_chat_messages;
create policy "scanplay_coach_chat_messages_insert_own"
  on public.scanplay_coach_chat_messages for insert
  with check (
    auth.uid() = user_id
    and role in ('user', 'assistant')
  );
