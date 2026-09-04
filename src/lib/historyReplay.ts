import { getHistory } from './history';
import { getPlan, PLAN_LIMITS } from './planLimits';
import type { Plan } from '../types';

/** How many most recent history decks can be replayed. */
export function getHistoryReplaySlots(plan?: Plan): number {
  const p = plan ?? getPlan();
  return PLAN_LIMITS[p].historyReplay;
}

export function canReplayHistoryEntry(entryId: string, plan?: Plan): boolean {
  const entries = getHistory();
  const slots = getHistoryReplaySlots(plan);
  const index = entries.findIndex((e) => e.id === entryId);
  return index >= 0 && index < slots;
}

export function isHistoryEntryReplayLocked(entryId: string, plan?: Plan): boolean {
  return !canReplayHistoryEntry(entryId, plan);
}
