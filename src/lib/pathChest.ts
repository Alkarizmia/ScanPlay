import { applyChestReward, rollDailyChest, type ChestReward } from './shop';
import type { ChestRarity } from './chestRarity';

const STORAGE_KEY = 'scanplay-path-chests';

/** Test : un coffre après le 2e nœud de jeu, un seul par parcours. */
export const PATH_TEST_CHEST_AFTER_STEP = 1;
export const PATH_TEST_CHEST_ID = 'path-test-1';

type ChestMap = Record<string, { opened: true }>;

function readMap(): ChestMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ChestMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: ChestMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function pathChestStorageKey(deckId: string | null | undefined): string {
  return deckId && deckId.length > 0 ? deckId : 'current';
}

export function isPathTestChestOpened(deckId: string | null | undefined): boolean {
  const map = readMap();
  return Boolean(map[pathChestStorageKey(deckId)]?.opened);
}

export function claimPathTestChest(
  deckId: string | null | undefined,
  rarity: ChestRarity = 'common',
): { ok: true; reward: ChestReward; rarity: ChestRarity } | { ok: false; reason: 'already_claimed' } {
  const key = pathChestStorageKey(deckId);
  const map = readMap();
  if (map[key]?.opened) return { ok: false, reason: 'already_claimed' };
  const reward = rollDailyChest(rarity);
  applyChestReward(reward, rarity);
  map[key] = { opened: true };
  writeMap(map);
  return { ok: true, reward, rarity };
}
