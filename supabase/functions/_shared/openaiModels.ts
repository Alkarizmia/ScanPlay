/** Paid plans (Plus / Pro) — best OCR for school sheets. */
export const SCANPLAY_DEFAULT_PAID_SCAN_MODEL = 'gpt-5.5';

/** Free + guest scans — cheaper vision that still reads sheets. */
export const SCANPLAY_DEFAULT_FREE_SCAN_MODEL = 'gpt-4.1';

type ScanPlan = 'free' | 'plus' | 'pro';

/** Vision + JSON extraction for school sheet photos (analyze-sheet). */
export function resolveScanModel(plan: ScanPlan = 'free'): string {
  if (plan === 'plus' || plan === 'pro') {
    return (
      Deno.env.get('OPENAI_SCAN_MODEL_PAID') ??
      SCANPLAY_DEFAULT_PAID_SCAN_MODEL
    );
  }
  return Deno.env.get('OPENAI_SCAN_MODEL_FREE') ?? SCANPLAY_DEFAULT_FREE_SCAN_MODEL;
}

/** Text synthesis (generate-synthesis) — keep mini for cost. */
export function resolveSynthesisModel(): string {
  return Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
}

/** GPT-5+ / GPT-6: reasoning tokens, max_completion_tokens, image detail original. */
export function isReasoningVisionModel(model: string): boolean {
  return /^(gpt-5|gpt-6|o[1-9])/i.test(model.trim());
}

export function scanReasoningEffort(sheetType: string): 'medium' | 'high' {
  if (sheetType === 'math' || sheetType === 'notes' || sheetType === 'definitions') {
    return 'high';
  }
  return 'medium';
}

export function scanImageDetail(model: string): 'high' | 'original' {
  return isReasoningVisionModel(model) ? 'original' : 'high';
}
