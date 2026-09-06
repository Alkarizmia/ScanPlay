import type { GameMode, WordPair } from '../types';
import { DEFAULT_PATH_STEP_COUNT } from './planLimits';
import { PATH_TEST_CHEST_AFTER_STEP, PATH_TEST_CHEST_ID } from './pathChest';
import { pickPathStepGames } from './pathGamePlan';

/** @deprecated use DEFAULT_PATH_STEP_COUNT or getPathStepCount() */
export const PATH_STEP_COUNT = DEFAULT_PATH_STEP_COUNT;

export type PathNode =
  | { kind: 'game'; id: number; games: GameMode[]; x: number; y: number }
  | { kind: 'chest'; chestId: string; x: number; y: number };

/** @deprecated use PathNode */
export type PathStep = PathNode;

export function buildPathSteps(
  count: number = DEFAULT_PATH_STEP_COUNT,
  pairs: WordPair[] = [],
  options?: { testChest?: boolean },
): PathNode[] {
  const fallback: WordPair[] = [{ term: 'a', definition: 'b' }];
  const source = pairs.length > 0 ? pairs : fallback;
  const includeChest = Boolean(options?.testChest) && count > PATH_TEST_CHEST_AFTER_STEP + 1;

  const visual: PathNode[] = [];
  for (let i = 0; i < count; i += 1) {
    visual.push({
      kind: 'game',
      id: i,
      games: pickPathStepGames(i, source),
      x: 0,
      y: 0,
    });
    if (includeChest && i === PATH_TEST_CHEST_AFTER_STEP) {
      visual.push({ kind: 'chest', chestId: PATH_TEST_CHEST_ID, x: 0, y: 0 });
    }
  }

  const n = visual.length;
  visual.forEach((node, i) => {
    node.x = i % 2 === 0 ? 26 : 74;
    node.y = n <= 1 ? 50 : 10 + (i / (n - 1)) * 80;
  });

  return visual;
}

export function buildPathD(steps: { x: number; y: number }[]) {
  const points = steps.map((s) => ({ x: s.x, y: s.y }));
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const midY = (prev.y + curr.y) / 2;
    d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
  }
  return d;
}

export const PATH_STEPS = buildPathSteps();

export function pathAreaHeight(nodeCount: number = DEFAULT_PATH_STEP_COUNT) {
  return Math.max(520, nodeCount * 92 + 120);
}

export function getFirstActiveStep(completedSteps: number[], total = PATH_STEP_COUNT) {
  for (let i = 0; i < total; i += 1) {
    if (!completedSteps.includes(i)) return i;
  }
  return total;
}

export function isStepLocked(stepIndex: number, completedSteps: number[]) {
  const active = getFirstActiveStep(completedSteps);
  return stepIndex > active;
}

export function isStepActive(stepIndex: number, completedSteps: number[]) {
  return stepIndex === getFirstActiveStep(completedSteps);
}

export function isStepDone(stepIndex: number, completedSteps: number[]) {
  return completedSteps.includes(stepIndex);
}
