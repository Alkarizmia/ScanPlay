/** Modèle vision par défaut pour l'extraction de fiches (analyze-sheet). */
export const SCANPLAY_DEFAULT_SCAN_MODEL = 'gpt-4.1';

/** Vision + JSON extraction for school sheet photos (analyze-sheet). */
export function resolveScanModel(): string {
  return Deno.env.get('OPENAI_SCAN_MODEL') ?? SCANPLAY_DEFAULT_SCAN_MODEL;
}
/** Text synthesis (generate-synthesis) — cheaper default is fine. */
export function resolveSynthesisModel(): string {
  return Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
}
