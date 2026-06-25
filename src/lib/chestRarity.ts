export type ChestRarity = 'common' | 'rare' | 'mythic' | 'legendary';

const RARITY_ORDER: ChestRarity[] = ['common', 'rare', 'mythic', 'legendary'];

/** Chance de monter d'un cran à chaque tap (sinon reste au niveau actuel). */
const UPGRADE_WEIGHTS: Record<ChestRarity, number> = {
  common: 0.22,
  rare: 0.12,
  mythic: 0.05,
  legendary: 0,
};

export const CHEST_RARITY_MULTIPLIER: Record<ChestRarity, number> = {
  common: 1,
  rare: 1.45,
  mythic: 2.1,
  legendary: 3.2,
};

export function chestRarityLabelKey(
  rarity: ChestRarity,
): 'chestRarityCommon' | 'chestRarityRare' | 'chestRarityMythic' | 'chestRarityLegendary' {
  const keys = {
    common: 'chestRarityCommon',
    rare: 'chestRarityRare',
    mythic: 'chestRarityMythic',
    legendary: 'chestRarityLegendary',
  } as const;
  return keys[rarity];
}

export function rollChestUpgrade(current: ChestRarity): ChestRarity {
  const idx = RARITY_ORDER.indexOf(current);
  if (idx < 0 || idx >= RARITY_ORDER.length - 1) return current;
  const chance = UPGRADE_WEIGHTS[current];
  if (Math.random() < chance) return RARITY_ORDER[idx + 1]!;
  return current;
}

export function scaleRewardAmount(amount: number, rarity: ChestRarity): number {
  return Math.max(1, Math.round(amount * CHEST_RARITY_MULTIPLIER[rarity]));
}
