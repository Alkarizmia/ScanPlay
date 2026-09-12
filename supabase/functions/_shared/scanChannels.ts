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
  return `Canal serveur: plan=${channel.plan} appareil=${channel.platform} plafond=${channel.maxPairs}
Extrais TOUTES les lignes visibles jusqu'à ${channel.maxPairs}. Pas d'échantillon (8/10/12).`;
}

/** Thin first pass → one full recount. */
export function needsFullRecount(
  sheetType: string,
  pairCount: number,
  maxPairs: number,
  finishReason?: string,
): boolean {
  if (sheetType === 'math') return false;
  if (pairCount <= 0 || pairCount >= maxPairs) return false;
  if (finishReason === 'length') return true;
  /* Undersample zone ~8–14 while quota allows more */
  return pairCount < Math.min(20, maxPairs);
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
