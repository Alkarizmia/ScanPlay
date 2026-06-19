import { getGamification, getLevel, getTotalScore } from './gamification';
import { getHistory } from './history';
import { getPathStepCount } from './planLimits';

const SCANS_KEY = 'scanplay-scans-day';

function getTotalScans(): number {
  try {
    const data = JSON.parse(localStorage.getItem(SCANS_KEY) ?? '{}') as Record<string, number>;
    return Object.values(data).reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

export interface AppStats {
  xp: number;
  level: number;
  streak: number;
  totalScore: number;
  deckCount: number;
  totalScans: number;
  stepsCompleted: number;
}

export function getAppStats(): AppStats {
  const { xp, streak } = getGamification();
  const history = getHistory();
  const stepsCompleted = history.reduce((sum, e) => sum + (e.completedSteps?.length ?? 0), 0);

  return {
    xp,
    level: getLevel(xp),
    streak,
    totalScore: getTotalScore(),
    deckCount: history.length,
    totalScans: getTotalScans(),
    stepsCompleted,
  };
}

export function getMaxStepsPossible(): number {
  return getPathStepCount() * Math.max(1, getHistory().length);
}
