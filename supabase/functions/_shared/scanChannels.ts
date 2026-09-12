import { PLAN_LIMITS, type Plan } from './planQuotas.ts';
import { resolveScanModel } from './openaiModels.ts';

export type ScanClientPlatform = 'ios' | 'android' | 'windows' | 'other';

export interface ScanChannel {
  plan: Plan;
  platform: ScanClientPlatform;
  maxPairs: number;
  model: string;
  label: string;
}

export function normalizeScanPlatform(value: unknown): ScanClientPlatform {
  if (value === 'ios' || value === 'android' || value === 'windows' || value === 'other') {
    return value;
  }
  return 'other';
}

/** Plan comes ONLY from Supabase profile (user id). Client maxPairs is ignored. */
export function resolveScanChannel(plan: Plan, platform: ScanClientPlatform): ScanChannel {
  const maxPairs = PLAN_LIMITS[plan].maxWords;
  const model = resolveScanModel(plan);
  return {
    plan,
    platform,
    maxPairs,
    model,
    label: `plan:${plan}|device:${platform}|cap:${maxPairs}|model:${model}`,
  };
}

/** Short channel header — avoid burning tokens on prose. */
export function buildScanChannelPrompt(channel: ScanChannel): string {
  return `Canal: plan=${channel.plan} appareil=${channel.platform} plafond=${channel.maxPairs}
Extrais TOUTES les lignes visibles jusqu'à ${channel.maxPairs}. Pas d'échantillon.`;
}

/** Thin first pass → recount when clearly short of a full sheet (not only classic ~8). */
export function needsFullRecount(
  sheetType: string,
  pairCount: number,
  maxPairs: number,
  finishReason?: string,
): boolean {
  /* Math / définitions-formules: one GPT pass only (Vision+OCR recount = hang). */
  if (sheetType === 'math' || sheetType === 'definitions') return false;
  if (pairCount <= 0 || pairCount >= maxPairs) return false;
  if (finishReason === 'length') return true;
  /* Phrase sheets often land at 9–12 without a second pass — push toward full coverage. */
  return pairCount < Math.min(maxPairs, 16);
}

export function buildFullRecountHint(
  sheetType: string,
  pairs: Array<{ term?: string; definition?: string }>,
  maxPairs: number,
): string {
  const listed = pairs
    .slice(0, 30)
    .map((p) => `${String(p.term ?? '').trim()}→${String(p.definition ?? '').trim()}`)
    .filter((line) => line.length > 3)
    .join(' | ');
  return `Couverture insuffisante (${pairs.length}/${maxPairs}). Relis toute la fiche.
Liste 2 colonnes: gauche=term (langue1), droite=definition (langue2). JAMAIS couper une phrase FR en deux (interdit: "De qui s'agit"→"il ?").
JSON complet avec TOUTES les paires (y compris déjà vues). Type=${sheetType}.
Déjà: ${listed || '—'}`;
}
