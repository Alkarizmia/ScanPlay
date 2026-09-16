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

function markOpened(key: string): void {
  const map = readMap();
  map[key] = { opened: true };
  writeMap(map);
}

/** When a scan gets a real history id, keep the chest that was opened as "current". */
export function migratePathChestToDeck(deckId: string | null | undefined): void {
  const key = pathChestStorageKey(deckId);
  if (key === 'current') return;
  const map = readMap();
  if (map[key]?.opened) return;
  if (!map.current?.opened) return;
  map[key] = { opened: true };
  delete map.current;
  writeMap(map);
}

export function hasOpenedAnyPathChest(): boolean {
  return Object.values(readMap()).some((entry) => entry?.opened);
}

export function isPathTestChestOpened(deckId: string | null | undefined): boolean {
  migratePathChestToDeck(deckId);
  const map = readMap();
  return Boolean(map[pathChestStorageKey(deckId)]?.opened);
}

/**
 * If the learner already plays nodes after the chest, never send them back
 * and never pay the reward again — persist the opened flag.
 */
export function healPathTestChestIfPastGate(
  deckId: string | null | undefined,
  firstActiveIdx: number,
): boolean {
  if (isPathTestChestOpened(deckId)) return true;
  if (firstActiveIdx <= PATH_TEST_CHEST_AFTER_STEP + 1) return false;
  markOpened(pathChestStorageKey(deckId));
  return true;
}

export function claimPathTestChest(
  deckId: string | null | undefined,
  rarity: ChestRarity = 'common',
): { ok: true; reward: ChestReward; rarity: ChestRarity } | { ok: false; reason: 'already_claimed' } {
  migratePathChestToDeck(deckId);
  const key = pathChestStorageKey(deckId);
  const map = readMap();
  if (map[key]?.opened) return { ok: false, reason: 'already_claimed' };
  const reward = rollDailyChest(rarity);
  applyChestReward(reward, rarity);
  map[key] = { opened: true };
  writeMap(map);
  return { ok: true, reward, rarity };
}
