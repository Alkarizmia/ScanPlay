import { useSyncExternalStore } from 'react';
import {
  getGameHudSnapshot,
  subscribeGameHud,
  type GameHudSnapshot,
} from '../lib/gameFeedback';

export function useGameHud(): GameHudSnapshot {
  return useSyncExternalStore(subscribeGameHud, getGameHudSnapshot, getGameHudSnapshot);
}
