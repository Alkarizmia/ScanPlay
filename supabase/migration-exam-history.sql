-- ============================================================
-- ScanPlay — Mise à jour : historique Examens + colonnes decks
-- À exécuter dans Supabase → SQL Editor → New query → Run
--
-- Nouveautés app (scanplay.org) :
--   • Historique séparé : Parcours (decks) vs Examens
--   • Note finale d'examen, étapes, chrono, 70% min
--   • Profil utilisateur + examHistory dans stats JSON (déjà supporté)
--
-- Ce script est idempotent (safe à relancer).
-- ============================================================


-- 1. Colonnes optionnelles sur scanplay_decks (parcours)
-- ------------------------------------------------------------

alter table public.scanplay_decks
  add column if not exists last_score_pct int,
  add column if not exists last_xp_earned int,
  add column if not exists last_played_at timestamptz,
  add column if not exists play_count int not null default 0,
  add column if not exists kind text not null default 'deck'
    check (kind in ('deck'));

comment on column public.scanplay_decks.last_score_pct is 'Dernier % de la session (parcours libre)';
comment on column public.scanplay_decks.last_played_at is 'Dernière partie sur ce deck';
comment on column public.scanplay_decks.kind is 'deck = parcours normal (pas un examen final)';


-- 2. Table scanplay_exam_history (examens terminés)
-- ------------------------------------------------------------

create table if not exists public.scanplay_exam_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_id uuid not null,
  deck_title text not null,
  thumbnail text,
  final_grade int not null check (final_grade >= 0 and final_grade <= 100),
  passed boolean not null default false,
  step_grades jsonb not null default '[]'::jsonb,
  total_time_seconds int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.scanplay_exam_history is
  'Résultats finaux mode Examen (10 étapes, note moyenne, min 70% pour passed)';

comment on column public.scanplay_exam_history.step_grades is
  'JSON: [{ "stepIndex": 0, "mode": "quiz", "pct": 85, "passed": true }, ...]';

create index if not exists scanplay_exam_history_user_id_idx
  on public.scanplay_exam_history (user_id);

create index if not exists scanplay_exam_history_user_created_idx
  on public.scanplay_exam_history (user_id, created_at desc);

create index if not exists scanplay_exam_history_deck_id_idx
  on public.scanplay_exam_history (deck_id);


-- 3. RLS exam_history
-- ------------------------------------------------------------

alter table public.scanplay_exam_history enable row level security;

drop policy if exists "scanplay_exam_history_select_own" on public.scanplay_exam_history;
drop policy if exists "scanplay_exam_history_insert_own" on public.scanplay_exam_history;
drop policy if exists "scanplay_exam_history_update_own" on public.scanplay_exam_history;
drop policy if exists "scanplay_exam_history_delete_own" on public.scanplay_exam_history;

create policy "scanplay_exam_history_select_own"
  on public.scanplay_exam_history for select
  using (auth.uid() = user_id);

create policy "scanplay_exam_history_insert_own"
  on public.scanplay_exam_history for insert
  with check (auth.uid() = user_id);

create policy "scanplay_exam_history_update_own"
  on public.scanplay_exam_history for update
  using (auth.uid() = user_id);

create policy "scanplay_exam_history_delete_own"
  on public.scanplay_exam_history for delete
  using (auth.uid() = user_id);


-- 4. Rappel : blob scanplay_user_stats.data (pas de table SQL obligatoire)
-- ------------------------------------------------------------
-- L'app stocke aussi dans data JSON :
--   "profile"         → { displayName, avatar, customAvatarData }
--   "examHistory"     → copie locale (optionnel si table exam_history utilisée)
--   "notifications", "achievementUnlocks", "best", "scansDay", ...
--
-- Aucune migration requise pour user_stats si la table existe déjà.


-- 5. Vérification
-- ------------------------------------------------------------

-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'scanplay_exam_history'
-- order by ordinal_position;

-- select count(*) from public.scanplay_exam_history;
