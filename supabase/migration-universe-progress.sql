-- ============================================================
-- ScanPlay — Progression Univers (anglais, puis autres)
-- Supabase → SQL Editor → Run
-- Idempotent (safe à relancer). Non destructif.
-- ============================================================

create table if not exists public.universe_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  universe text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, universe)
);

comment on table public.universe_progress is
  'Progression Univers liée au compte (english, permis, …). data = blob JSON app.';

comment on column public.universe_progress.universe is
  'Identifiant du parcours Univers, ex. english';

comment on column public.universe_progress.data is
  'Profil JSON (niveau, objectif, leçons faites, chapitres skippés, mots ratés, …)';

create index if not exists universe_progress_user_id_idx
  on public.universe_progress (user_id);

create index if not exists universe_progress_updated_at_idx
  on public.universe_progress (updated_at desc);

alter table public.universe_progress enable row level security;

drop policy if exists "universe_progress_select_own" on public.universe_progress;
drop policy if exists "universe_progress_insert_own" on public.universe_progress;
drop policy if exists "universe_progress_update_own" on public.universe_progress;
drop policy if exists "universe_progress_delete_own" on public.universe_progress;

create policy "universe_progress_select_own"
  on public.universe_progress for select
  using (auth.uid() = user_id);

create policy "universe_progress_insert_own"
  on public.universe_progress for insert
  with check (auth.uid() = user_id);

create policy "universe_progress_update_own"
  on public.universe_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "universe_progress_delete_own"
  on public.universe_progress for delete
  using (auth.uid() = user_id);
