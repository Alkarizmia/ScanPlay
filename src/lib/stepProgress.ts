import type { GameMode, StepProgressMap, StepResult, StepTier, WordPair } from '../types';
import { DEFAULT_PATH_STEP_COUNT, getPathStepCount } from './planLimits';
import { isNodeAllGold, pickPathStepGames } from './pathGamePlan';

export const EXAM_PASS_PCT = 70;
/** Sentinel: mic unavailable / skip all oral — not graded, exam-safe. */
export const TECHNICAL_PCT = -1;

export function isTechnicalResult(pct: number): boolean {
  return pct < 0;
}

const TIER_RANK: Record<StepTier, number> = { bronze: 0, iron: 1, gold: 2 };

export function getTierFromPct(pct: number): StepTier | null {
  if (isTechnicalResult(pct)) return null;
  if (pct >= 100) return 'gold';
  if (pct >= 70) return 'iron';
  return 'bronze';
}

/** Tier affiché sur le parcours (recalculé depuis le % pour les paliers visuels). */
export function getDisplayTierFromResult(result: StepResult | undefined): StepTier | undefined {
  if (!result) return undefined;
  return getTierFromPct(result.pct) ?? undefined;
}

export function getXpMultiplier(tier: StepTier): number {
  if (tier === 'gold') return 1;
  if (tier === 'iron') return 0.75;
  return 0.45;
}

export function migrateCompletedSteps(completedSteps?: number[]): StepProgressMap {
  const map: StepProgressMap = {};
  completedSteps?.forEach((i) => {
    map[i] = { pct: 100, tier: 'gold' };
  });
  return map;
}

export function normalizeStepProgress(
  stepProgress?: StepProgressMap,
  completedSteps?: number[],
): StepProgressMap {
  if (stepProgress && Object.keys(stepProgress).length > 0) return stepProgress;
  return migrateCompletedSteps(completedSteps);
}

function hasLegacyComplete(result: StepResult | undefined): boolean {
  return Boolean(result && (!result.games || Object.keys(result.games).length === 0));
}

function isNodeGamesComplete(
  stepIndex: number,
  progress: StepProgressMap,
  pairs?: WordPair[],
): boolean {
  const result = progress[stepIndex];
  if (!result) return false;
  if (hasLegacyComplete(result)) return true;
  if (!pairs) return Object.keys(result.games ?? {}).length > 0;
  const games = pickPathStepGames(stepIndex, pairs);
  return games.every((g) => result.games?.[g] != null);
}

export function isStepCleared(
  stepIndex: number,
  progress: StepProgressMap,
  examMode?: boolean,
  pairs?: WordPair[],
): boolean {
  const result = progress[stepIndex];
  if (!result) return false;
  if (examMode) {
    if (result.pct >= EXAM_PASS_PCT || isTechnicalResult(result.pct)) return true;
    if (pairs) {
      const games = pickPathStepGames(stepIndex, pairs);
      if (games.length === 0) return false;
      return games.every((g) => {
        const sg = result.games?.[g];
        if (!sg) return false;
        return sg.pct >= EXAM_PASS_PCT || isTechnicalResult(sg.pct);
      });
    }
    return false;
  }
  if (pairs) return isNodeGamesComplete(stepIndex, progress, pairs);
  return true;
}

export function getFirstActiveStep(
  progress: StepProgressMap,
  totalSteps = getPathStepCount(),
  examMode?: boolean,
  pairs?: WordPair[],
): number {
  for (let i = 0; i < totalSteps; i += 1) {
    if (!isStepCleared(i, progress, examMode, pairs)) return i;
  }
  return totalSteps;
}

export function isStepLocked(
  stepIndex: number,
  progress: StepProgressMap,
  totalSteps = getPathStepCount(),
  examMode?: boolean,
  pairs?: WordPair[],
): boolean {
  return stepIndex > getFirstActiveStep(progress, totalSteps, examMode, pairs);
}

export function isStepActive(
  stepIndex: number,
  progress: StepProgressMap,
  totalSteps = getPathStepCount(),
  examMode?: boolean,
  pairs?: WordPair[],
): boolean {
  return stepIndex === getFirstActiveStep(progress, totalSteps, examMode, pairs);
}

export function getStepResult(
  stepIndex: number,
  progress: StepProgressMap,
): StepResult | undefined {
  return progress[stepIndex];
}

export function canPlayStep(
  stepIndex: number,
  progress: StepProgressMap,
  options?: {
    historyReplay?: boolean;
    examMode?: boolean;
    totalSteps?: number;
    pairs?: WordPair[];
  },
): boolean {
  if (options?.historyReplay) return true;

  const examMode = options?.examMode ?? false;
  const totalSteps = options?.totalSteps ?? getPathStepCount();
  const pairs = options?.pairs;

  if (isStepLocked(stepIndex, progress, totalSteps, examMode, pairs)) return false;

  const active = getFirstActiveStep(progress, totalSteps, examMode, pairs);

  if (examMode) {
    return stepIndex === active && !isStepCleared(stepIndex, progress, true, pairs);
  }

  const result = progress[stepIndex];
  if (pairs && isNodeAllGold(stepIndex, progress, pairs)) return true;
  if (result?.tier === 'gold' && hasLegacyComplete(result)) return true;
  if (stepIndex === active) return true;
  if (stepIndex < active && result) return true;
  return false;
}

export function countGoldSteps(progress: StepProgressMap, pairs?: WordPair[]): number {
  if (!pairs) {
    return Object.values(progress).filter((r) => r.tier === 'gold').length;
  }
  let n = 0;
  for (const key of Object.keys(progress)) {
    const idx = Number(key);
    if (isNodeAllGold(idx, progress, pairs)) n += 1;
  }
  return n;
}

export function countAttemptedSteps(progress: StepProgressMap): number {
  return Object.keys(progress).length;
}

export function countClearedSteps(
  progress: StepProgressMap,
  examMode?: boolean,
  totalSteps = getPathStepCount(),
  pairs?: WordPair[],
): number {
  if (examMode) {
    let n = 0;
    for (let i = 0; i < totalSteps; i += 1) {
      if (isStepCleared(i, progress, true, pairs)) n += 1;
    }
    return n;
  }
  if (pairs) {
    let n = 0;
    for (let i = 0; i < totalSteps; i += 1) {
      if (isStepCleared(i, progress, false, pairs)) n += 1;
    }
    return n;
  }
  return countAttemptedSteps(progress);
}

export function mergeStepResult(
  progress: StepProgressMap,
  stepIndex: number,
  pct: number,
): StepProgressMap {
  const tier = getTierFromPct(pct);
  const existing = progress[stepIndex];
  if (existing) {
    if (tier && existing.tier && TIER_RANK[tier] < TIER_RANK[existing.tier]) return progress;
    if (tier === existing.tier && pct <= existing.pct && !isTechnicalResult(pct)) return progress;
    if (isTechnicalResult(existing.pct) && !isTechnicalResult(pct)) {
      /* keep real score over technical */
    } else if (isTechnicalResult(pct) && !isTechnicalResult(existing.pct)) {
      return progress;
    }
  }
  return { ...progress, [stepIndex]: { pct, tier: tier ?? 'bronze' } };
}

export function mergeSubGameResult(
  progress: StepProgressMap,
  stepIndex: number,
  mode: GameMode,
  pct: number,
  pairs: WordPair[],
): StepProgressMap {
  const tier = getTierFromPct(pct);
  const existing = progress[stepIndex];
  const games = { ...(existing?.games ?? {}) };
  const prev = games[mode];

  if (prev && !isTechnicalResult(pct)) {
    const prevTier = prev.tier;
    if (tier && TIER_RANK[tier] < TIER_RANK[prevTier]) return progress;
    if (tier === prevTier && pct <= prev.pct) return progress;
  }
  if (prev && isTechnicalResult(pct) && !isTechnicalResult(prev.pct)) {
    return progress;
  }

  games[mode] = { pct, tier: tier ?? prev?.tier ?? 'bronze' };

  const stepGames = pickPathStepGames(stepIndex, pairs);
  const scored = stepGames
    .map((g) => games[g]?.pct)
    .filter((p): p is number => p !== undefined && !isTechnicalResult(p));
  const allDone = stepGames.every((g) => games[g]);
  const overallPct =
    scored.length > 0
      ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
      : allDone && stepGames.some((g) => isTechnicalResult(games[g]?.pct ?? 0))
        ? TECHNICAL_PCT
        : 0;
  const tiers = stepGames
    .map((g) => games[g]?.tier)
    .filter((t): t is StepTier => Boolean(t));
  const minTier = tiers.reduce<StepTier>(
    (min, t) => (TIER_RANK[t] < TIER_RANK[min] ? t : min),
    'gold',
  );
  const overallTier = isTechnicalResult(overallPct)
    ? 'bronze'
    : allDone
      ? minTier
      : getTierFromPct(overallPct) ?? 'bronze';

  return {
    ...progress,
    [stepIndex]: { pct: overallPct, tier: overallTier, games },
  };
}

export function isPathComplete(
  progress: StepProgressMap,
  examMode?: boolean,
  totalSteps = getPathStepCount(),
  pairs?: WordPair[],
): boolean {
  if (examMode) {
    for (let i = 0; i < totalSteps; i += 1) {
      if (!isStepCleared(i, progress, true, pairs)) return false;
    }
    return true;
  }
  if (pairs) {
    for (let i = 0; i < totalSteps; i += 1) {
      if (!isStepCleared(i, progress, false, pairs)) return false;
    }
    return true;
  }
  return countAttemptedSteps(progress) >= totalSteps;
}

/** Fallback for legacy decks without stored pathStepCount. */
export function resolvePathStepCount(stored?: number): number {
  if (stored != null && stored > 0) return stored;
  return DEFAULT_PATH_STEP_COUNT;
}
