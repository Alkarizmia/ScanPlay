-- ============================================================
-- ScanPlay — Historique : onglets Parcours / Examens
-- À exécuter dans Supabase → SQL Editor → New query → Run
--
-- Changements app :
--   • Historique : 2 onglets (Parcours = tout le parcours libre, Examens = mode examen)
--   • Carte examen : temps total du parcours (total_time_seconds)
--   • Nombre d'étapes du parcours (path_step_count)
--
-- Idempotent — safe à relancer.
-- ============================================================

-- 1. Colonne path_step_count sur scanplay_exam_history
alter table public.scanplay_exam_history
  add column if not exists path_step_count int;

comment on column public.scanplay_exam_history.path_step_count is
  'Nombre d''étapes du parcours au moment de l''examen (ex. 10)';

comment on column public.scanplay_exam_history.total_time_seconds is
  'Durée totale en secondes pour terminer tout le parcours en mode examen';

-- 2. Backfill path_step_count depuis step_grades (nombre d''étapes distinctes)
update public.scanplay_exam_history
set path_step_count = sub.cnt
from (
  select
    id,
    greatest(
      coalesce(
        (
          select count(distinct (elem->>'stepIndex')::int)
          from jsonb_array_elements(step_grades) as elem
        ),
        0
      ),
      10
    ) as cnt
  from public.scanplay_exam_history
  where path_step_count is null
) as sub
where scanplay_exam_history.id = sub.id;

-- 3. Valeur par défaut pour les lignes sans step_grades
update public.scanplay_exam_history
set path_step_count = 10
where path_step_count is null;

-- 4. Vérification (décommenter si besoin)
-- select id, deck_title, final_grade, passed, path_step_count, total_time_seconds, created_at
-- from public.scanplay_exam_history
-- order by created_at desc
-- limit 20;
