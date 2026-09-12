/** Default vision model for all plans — photo pipeline matters more than GPT-5.x spend. */
export const SCANPLAY_DEFAULT_SCAN_MODEL = 'gpt-4.1';

/** @deprecated Alias kept for older env docs / imports. */
export const SCANPLAY_DEFAULT_FREE_SCAN_MODEL = SCANPLAY_DEFAULT_SCAN_MODEL;

/** Paid exercises / coach overrides may still point here. */
export const SCANPLAY_DEFAULT_PAID_SCAN_MODEL = 'gpt-5.5';

type ScanPlan = 'free' | 'plus' | 'pro';

/**
 * Scan vision: same model for free / plus / pro (default gpt-4.1).
 * Override with OPENAI_SCAN_MODEL (all plans) if needed.
 */
export function resolveScanModel(_plan: ScanPlan = 'free'): string {
  return (
    Deno.env.get('OPENAI_SCAN_MODEL') ??
    Deno.env.get('OPENAI_SCAN_MODEL_FREE') ??
    SCANPLAY_DEFAULT_SCAN_MODEL
  );
}

/** Text games. Free = 4.1 ; Plus/Pro can stay on paid if env set. */
export function resolveExerciseModel(plan: ScanPlan = 'free'): string {
  if (plan === 'pro') {
    return (
      Deno.env.get('OPENAI_EXERCISE_MODEL_PRO') ??
      Deno.env.get('OPENAI_EXERCISE_MODEL_PAID') ??
      SCANPLAY_DEFAULT_PAID_SCAN_MODEL
    );
  }
  if (plan === 'plus') {
    return (
      Deno.env.get('OPENAI_EXERCISE_MODEL_PLUS') ??
      Deno.env.get('OPENAI_EXERCISE_MODEL_PAID') ??
      SCANPLAY_DEFAULT_PAID_SCAN_MODEL
    );
  }
  return Deno.env.get('OPENAI_EXERCISE_MODEL_FREE') ?? SCANPLAY_DEFAULT_SCAN_MODEL;
}

/** Text synthesis (generate-synthesis) — keep mini for cost. */
export function resolveSynthesisModel(): string {
  return Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
}

/** Mini-coach chat. Free stays on mini. Plus/Pro can use 4.1. */
export function resolveCoachModel(plan: ScanPlan = 'free'): string {
  if (plan === 'plus' || plan === 'pro') {
    return Deno.env.get('OPENAI_COACH_MODEL_PAID') ?? SCANPLAY_DEFAULT_SCAN_MODEL;
  }
  return Deno.env.get('OPENAI_COACH_MODEL_FREE') ?? 'gpt-4o-mini';
}

/** GPT-5+ / GPT-6: reasoning tokens, max_completion_tokens, image detail original. */
export function isReasoningVisionModel(model: string): boolean {
  return /^(gpt-5|gpt-6|o[1-9])/i.test(model.trim());
}

export function scanReasoningEffort(sheetType: string): 'low' | 'medium' | 'high' {
  if (sheetType === 'math') return 'high';
  if (sheetType === 'notes' || sheetType === 'definitions') return 'medium';
  return 'low';
}

export function scanImageDetail(model: string): 'high' | 'original' {
  return isReasoningVisionModel(model) ? 'original' : 'high';
}
