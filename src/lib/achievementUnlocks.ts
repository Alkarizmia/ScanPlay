import {
  ACHIEVEMENTS,
  isAchievementUnlocked,
  type AchievementDef,
  type AchievementId,
} from './achievements';
import { isLoggedIn } from './auth';

const KEY = 'scanplay-achievement-unlocks';

export interface UnlockRecord {
  id: AchievementId;
  unlockedAt: string;
}

export function loadUnlockRecords(): UnlockRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveUnlockRecordsRaw(records: UnlockRecord[]): void {
  localStorage.setItem(KEY, JSON.stringify(records));
}

export function snapshotUnlockedIds(): Set<AchievementId> {
  return new Set(
    ACHIEVEMENTS.filter((a) => isAchievementUnlocked(a.id)).map((a) => a.id),
  );
}

export function getNewUnlocksSince(before: Set<AchievementId>): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => isAchievementUnlocked(a.id) && !before.has(a.id));
}

export function recordUnlocks(ids: AchievementId[]): void {
  if (!isLoggedIn() || ids.length === 0) return;
  const records = loadUnlockRecords();
  const now = new Date().toISOString();
  for (const id of ids) {
    if (!records.some((r) => r.id === id)) {
      records.unshift({ id, unlockedAt: now });
    }
  }
  saveUnlockRecordsRaw(records.slice(0, 50));
  void import('./sync').then((m) => m.scheduleSync());
  void import('./social/publicAchievements').then((m) => m.syncPublicAchievements());
}

export function processNewUnlocks(before?: Set<AchievementId>): AchievementDef[] {
  const prior = before ?? snapshotUnlockedIds();
  const newUnlocks = getNewUnlocksSince(prior);
  if (newUnlocks.length === 0) return [];
  recordUnlocks(newUnlocks.map((u) => u.id));
  return newUnlocks;
}

export function getRecentUnlocks(limit = 3): UnlockRecord[] {
  return loadUnlockRecords().slice(0, limit);
}

export function getAchievementDef(id: AchievementId): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
