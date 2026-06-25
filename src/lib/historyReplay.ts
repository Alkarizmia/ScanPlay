import { getHistory } from './history';
import { getPlan } from './planLimits';
import type { Plan } from '../types';

/** How many most recent history decks can be replayed. */
export function getHistoryReplaySlots(plan?: Plan): number {
  const p = plan ?? getPlan();
  if (p === 'pro') return 3;
  if (p === 'plus') return 2;
  return 1;
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
