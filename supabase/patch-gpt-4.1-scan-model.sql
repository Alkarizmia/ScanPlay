-- ScanPlay : passage au modèle gpt-4.1 pour le scan photo (analyze-sheet)
-- Date : 2026-06-19
--
-- ⚠️ Le modèle OpenAI ne se configure PAS uniquement en SQL.
-- Après ce script, exécute aussi (terminal, projet Supabase lié) :
--
--   supabase secrets set OPENAI_SCAN_MODEL=gpt-4.1
--   supabase functions deploy analyze-sheet
--
-- Synthèse texte (optionnel, reste sur mini) :
--   supabase secrets set OPENAI_MODEL=gpt-4o-mini
--   supabase functions deploy generate-synthesis

-- Traçabilité config prod (lecture admin / service_role uniquement)
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_config (key, value)
VALUES ('openai_scan_model', 'gpt-4.1')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

INSERT INTO public.app_config (key, value)
VALUES ('openai_synthesis_model', 'gpt-4o-mini')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Aucune policy = accès réservé service_role (Dashboard SQL, Edge Functions admin)

-- Vérification
SELECT key, value, updated_at
FROM public.app_config
WHERE key IN ('openai_scan_model', 'openai_synthesis_model')
ORDER BY key;
