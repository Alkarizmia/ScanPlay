import type { TranslationKey } from './i18n';
import { addBonusXp, todayKey } from './gamification';
import { getHistory } from './history';
import { addCoins, canClaimDailyChest } from './wallet';

const PLAYS_KEY = 'scanplay-plays-day';
const CLAIMS_KEY = 'scanplay-mission-claims';

export const MAX_DAILY_MISSIONS = 3;

export type MissionReward = { type: 'xp' | 'coins'; amount: number };

export interface DailyMission {
  id: 'scan' | 'play' | 'chest';
  icon: string;
  nameKey: TranslationKey;
  count?: number;
  current: number;
  goal: number;
  reward: MissionReward;
}

interface ClaimsState {
  date: string;
  claimed: string[];
}

function readDayCount(storageKey: string): number {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Record<string, number>;
    return data[todayKey()] ?? 0;
  } catch {
    return 0;
  }
}

function getScansToday(): number {
  const today = todayKey();
  return getHistory().filter((entry) => entry.createdAt.startsWith(today)).length;
}

function dayParity(): number {
  const key = todayKey();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash) % 2;
}

function rewardFor(id: DailyMission['id']): MissionReward {
  const even = dayParity() === 0;
  if (id === 'scan') return even ? { type: 'xp', amount: 50 } : { type: 'coins', amount: 20 };
  if (id === 'play') return even ? { type: 'coins', amount: 25 } : { type: 'xp', amount: 40 };
  return even ? { type: 'xp', amount: 30 } : { type: 'coins', amount: 15 };
}

function loadClaims(): ClaimsState {
  try {
    const data = JSON.parse(localStorage.getItem(CLAIMS_KEY) ?? '{}') as ClaimsState;
    if (data.date === todayKey() && Array.isArray(data.claimed)) return data;
  } catch {
    /* ignore */
  }
  return { date: todayKey(), claimed: [] };
}

function saveClaims(state: ClaimsState): void {
  localStorage.setItem(CLAIMS_KEY, JSON.stringify(state));
}

function grantReward(reward: MissionReward): void {
  if (reward.type === 'coins') addCoins(reward.amount);
  else addBonusXp(reward.amount);
}

export function bumpDailyPlays(): void {
  try {
    const data = JSON.parse(localStorage.getItem(PLAYS_KEY) ?? '{}') as Record<string, number>;
    const key = todayKey();
    data[key] = (data[key] ?? 0) + 1;
    localStorage.setItem(PLAYS_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getDailyMissions(): DailyMission[] {
  const missions: DailyMission[] = [
    {
      id: 'scan',
      icon: '📄',
      nameKey: 'dashMissionScan',
      count: 2,
      current: getScansToday(),
      goal: 2,
      reward: rewardFor('scan'),
    },
    {
      id: 'play',
      icon: '🎯',
      nameKey: 'dashMissionPlay',
      count: 2,
      current: readDayCount(PLAYS_KEY),
      goal: 2,
      reward: rewardFor('play'),
    },
    {
      id: 'chest',
      icon: '📦',
      nameKey: 'dashMissionChest',
      current: canClaimDailyChest() ? 0 : 1,
      goal: 1,
      reward: rewardFor('chest'),
    },
  ];
  return missions.slice(0, MAX_DAILY_MISSIONS);
}

/** Grant rewards for newly completed missions. Returns true if anything was granted. */
export function settleDailyMissionRewards(): boolean {
  const claims = loadClaims();
  const claimed = new Set(claims.claimed);
  let granted = false;
  for (const mission of getDailyMissions()) {
    if (mission.current < mission.goal || claimed.has(mission.id)) continue;
    grantReward(mission.reward);
    claimed.add(mission.id);
    granted = true;
  }
  if (granted) saveClaims({ date: todayKey(), claimed: [...claimed] });
  return granted;
}
