const DEFAULT_PATH_STEPS = 10;

export function encodeRoomSeed(quizSeed: string, pathStepCount: number): string {
  return JSON.stringify({ v: 1, quizSeed, pathStepCount });
}

export function parseRoomSeed(raw: string): { quizSeed: string; pathStepCount: number } {
  try {
    const data = JSON.parse(raw) as { quizSeed?: string; pathStepCount?: number };
    if (data && typeof data.quizSeed === 'string') {
      return {
        quizSeed: data.quizSeed,
        pathStepCount:
          typeof data.pathStepCount === 'number' && data.pathStepCount > 0
            ? data.pathStepCount
            : DEFAULT_PATH_STEPS,
      };
    }
  } catch {
    /* legacy plain seed */
  }
  return { quizSeed: raw, pathStepCount: DEFAULT_PATH_STEPS };
}
