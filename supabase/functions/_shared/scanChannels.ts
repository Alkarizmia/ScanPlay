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

/** Prefixed onto the user prompt so the model never guesses Free vs Pro. */
export function buildScanChannelPrompt(channel: ScanChannel): string {
  return `CANAL SCANPLAY (décidé côté serveur via le profil Supabase de l'utilisateur — ne suppose PAS le plan)
- plan abonnement : ${channel.plan}
- appareil client : ${channel.platform}
- plafond paires pour CE scan : ${channel.maxPairs}
- modèle vision : ${channel.model}

Règles canal :
- Extrais TOUTES les paires / idées visibles jusqu'à ${channel.maxPairs}.
- Le plan "${channel.plan}" change UNIQUEMENT le plafond (${channel.maxPairs}), PAS la qualité de lecture ligne à ligne.
- INTERDIT de renvoyer un échantillon (4, 5, 7, 8, 10, 12…) s'il reste des lignes lisibles.
- Si la fiche a 13 ou 18 lignes, renvoie 13 ou 18 paires (sauf si > ${channel.maxPairs}, alors coupe à ${channel.maxPairs}).`;
}

/** Thin first pass → full recount (not "missing only"). */
export function needsFullRecount(
  sheetType: string,
  pairCount: number,
  maxPairs: number,
  finishReason?: string,
): boolean {
  if (sheetType === 'math') return false;
  if (pairCount <= 0) return false;
  if (pairCount >= maxPairs) return false;
  if (finishReason === 'length') return true;
  /* Classic undersample is ~8 ; recount while clearly under quota. */
  const sparseCeil = Math.min(24, Math.max(12, Math.floor(maxPairs * 0.5)));
  return pairCount <= sparseCeil;
}

export function buildFullRecountHint(
  sheetType: string,
  pairs: Array<{ term?: string; definition?: string }>,
  maxPairs: number,
): string {
  const listed = pairs
    .slice(0, 50)
    .map((p) => `- ${String(p.term ?? '').trim()} → ${String(p.definition ?? '').trim()}`)
    .filter((line) => line.length > 5)
    .join('\n');
  return `RELECTURE OBLIGATOIRE (couverture incomplète) :
La 1re passe n'a renvoyé que ${pairs.length} paires (plafond ${maxPairs}). C'est trop peu si la fiche en contient plus.
Relis TOUTE l'image (haut → bas, toutes colonnes), y compris texte devant drapeaux/déco.
Renvoie un JSON COMPLET au format imposé avec TOUTES les paires visibles (réinclus celles déjà vues + les manquantes).
INTERDIT de t'arrêter à 8. Type attendu : ${sheetType}. Plafond : ${maxPairs}.

Paires déjà vues (à garder ou corriger, et COMPLÉTER) :
${listed || '(aucune)'}`;
}
