import type { GameMode, WordPair } from '../types';

import { DEFAULT_PATH_STEP_COUNT } from './planLimits';

import { pickPathStepGames } from './pathGamePlan';



/** @deprecated use DEFAULT_PATH_STEP_COUNT or getPathStepCount() */

export const PATH_STEP_COUNT = DEFAULT_PATH_STEP_COUNT;



export interface PathStep {

  id: number;

  games: GameMode[];

  x: number;

  y: number;

}



export function buildPathSteps(count: number = DEFAULT_PATH_STEP_COUNT, pairs: WordPair[] = []): PathStep[] {

  return Array.from({ length: count }, (_, i) => ({

    id: i,

    games: pairs.length > 0 ? pickPathStepGames(i, pairs) : pickPathStepGames(i, [{ term: 'a', definition: 'b' }]),

    x: i % 2 === 0 ? 26 : 74,

    y: count <= 1 ? 50 : 10 + (i / (count - 1)) * 80,

  }));

}



export function buildPathD(steps: PathStep[]) {

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



export function pathAreaHeight(stepCount: number = DEFAULT_PATH_STEP_COUNT) {

  return Math.max(520, stepCount * 92 + 120);

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

