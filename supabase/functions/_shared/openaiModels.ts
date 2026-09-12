/** Paid plans — best OCR for school sheets. */
export const SCANPLAY_DEFAULT_PAID_SCAN_MODEL = 'gpt-5.5';

/** Free scans — cheaper vision that still reads sheets. */
export const SCANPLAY_DEFAULT_FREE_SCAN_MODEL = 'gpt-4.1';

type ScanPlan = 'free' | 'plus' | 'pro';

/**
 * Vision model per plan channel (isolated).
 * free → FREE model ; plus → PLUS model ; pro → PRO model.
 * Env overrides stay plan-specific so Free never shares Pro config.
 */
export function resolveScanModel(plan: ScanPlan = 'free'): string {
  if (plan === 'pro') {
    return (
      Deno.env.get('OPENAI_SCAN_MODEL_PRO') ??
      Deno.env.get('OPENAI_SCAN_MODEL_PAID') ??
      SCANPLAY_DEFAULT_PAID_SCAN_MODEL
    );
  }
  if (plan === 'plus') {
    return (
      Deno.env.get('OPENAI_SCAN_MODEL_PLUS') ??
      Deno.env.get('OPENAI_SCAN_MODEL_PAID') ??
      SCANPLAY_DEFAULT_PAID_SCAN_MODEL
    );
  }
  return Deno.env.get('OPENAI_SCAN_MODEL_FREE') ?? SCANPLAY_DEFAULT_FREE_SCAN_MODEL;
}

/** Text games. Free = 4.1 ; Plus/Pro = paid (isolated env keys). */
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
  return Deno.env.get('OPENAI_EXERCISE_MODEL_FREE') ?? SCANPLAY_DEFAULT_FREE_SCAN_MODEL;
}

/** Text synthesis (generate-synthesis) — keep mini for cost. */
export function resolveSynthesisModel(): string {
  return Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
}

/** Mini-coach chat. Free stays on mini. Plus/Pro can use 4.1. */
export function resolveCoachModel(plan: ScanPlan = 'free'): string {
  if (plan === 'plus' || plan === 'pro') {
    return Deno.env.get('OPENAI_COACH_MODEL_PAID') ?? SCANPLAY_DEFAULT_FREE_SCAN_MODEL;
  }
  return Deno.env.get('OPENAI_COACH_MODEL_FREE') ?? 'gpt-4o-mini';
}

/** GPT-5+ / GPT-6: reasoning tokens, max_completion_tokens, image detail original. */
export function isReasoningVisionModel(model: string): boolean {
  return /^(gpt-5|gpt-6|o[1-9])/i.test(model.trim());
}

/**
 * Vocab/notes: low reasoning so completion tokens go to listing ALL pairs (avoids ~8-card samples).
 * Math keeps high effort for formula reading.
 */
export function scanReasoningEffort(sheetType: string): 'low' | 'medium' | 'high' {
  if (sheetType === 'math') return 'high';
  if (sheetType === 'notes' || sheetType === 'definitions') return 'medium';
  return 'low';
}

export function scanImageDetail(model: string): 'high' | 'original' {
  return isReasoningVisionModel(model) ? 'original' : 'high';
}
