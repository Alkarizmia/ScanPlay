/** Default vision model for all plans — photo pipeline matters more than GPT-5.x spend. */
export const SCANPLAY_DEFAULT_SCAN_MODEL = 'gpt-4.1';

/** @deprecated Alias kept for older env docs / imports. */
export const SCANPLAY_DEFAULT_FREE_SCAN_MODEL = SCANPLAY_DEFAULT_SCAN_MODEL;

/** Paid exercises / coach overrides may still point here. */
export const SCANPLAY_DEFAULT_PAID_SCAN_MODEL = 'gpt-5.5';

type ScanPlan = 'free' | 'plus' | 'pro' | 'max';

const SCANPLAY_SAVER_MODEL = 'gpt-4o-mini';

export interface ModelResolveOpts {
  /** True when AI envelope ≥ 90% — cheaper models to stretch remaining budget. */
  saver?: boolean;
}

/**
 * Scan vision: same model for free / plus / pro / max (default gpt-4.1).
 * At ≥90% AI usage, step down to saver model to burn fewer tokens.
 */
export function resolveScanModel(_plan: ScanPlan = 'free', opts: ModelResolveOpts = {}): string {
  if (opts.saver) {
    return Deno.env.get('OPENAI_SCAN_MODEL_SAVER') ?? SCANPLAY_SAVER_MODEL;
  }
  return (
    Deno.env.get('OPENAI_SCAN_MODEL') ??
    Deno.env.get('OPENAI_SCAN_MODEL_FREE') ??
    SCANPLAY_DEFAULT_SCAN_MODEL
  );
}

/** Translate exercise rounds: Free = mini ; Plus/Pro/Max = gpt-4.1. */
export function resolveExerciseModel(plan: ScanPlan = 'free', opts: ModelResolveOpts = {}): string {
  if (opts.saver) {
    return Deno.env.get('OPENAI_EXERCISE_MODEL_SAVER') ?? SCANPLAY_SAVER_MODEL;
  }
  if (plan === 'plus' || plan === 'pro' || plan === 'max') {
    return (
      Deno.env.get('OPENAI_EXERCISE_MODEL_PAID') ??
      Deno.env.get('OPENAI_EXERCISE_MODEL_PLUS') ??
      Deno.env.get('OPENAI_EXERCISE_MODEL_PRO') ??
      SCANPLAY_DEFAULT_SCAN_MODEL
    );
  }
  return Deno.env.get('OPENAI_EXERCISE_MODEL_FREE') ?? SCANPLAY_SAVER_MODEL;
}

/** Text synthesis (generate-synthesis) — keep mini for cost. */
export function resolveSynthesisModel(opts: ModelResolveOpts = {}): string {
  if (opts.saver) {
    return Deno.env.get('OPENAI_SYNTHESIS_MODEL_SAVER') ?? SCANPLAY_SAVER_MODEL;
  }
  return Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
}

/** Mini-coach chat — text-only, cheap model; scan stays on gpt-4.1. */
export const SCANPLAY_DEFAULT_COACH_MODEL = 'gpt-4o-mini';

/** Mini-coach — available on all plans within the AI envelope. */
export function resolveCoachModel(_plan: ScanPlan = 'free', opts: ModelResolveOpts = {}): string {
  if (opts.saver) {
    return Deno.env.get('OPENAI_COACH_MODEL_SAVER') ?? SCANPLAY_SAVER_MODEL;
  }
  return (
    Deno.env.get('OPENAI_COACH_MODEL_PAID') ??
    Deno.env.get('OPENAI_COACH_MODEL_FREE') ??
    SCANPLAY_DEFAULT_COACH_MODEL
  );
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
