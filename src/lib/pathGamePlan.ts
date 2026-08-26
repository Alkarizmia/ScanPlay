import type { GameMode, StepProgressMap, WordPair } from '../types';
import { isTechnicalResult } from './stepProgress';
import {
  coercePlayablePairs,
  hasEnoughMatchPairs,
  hasEnoughQuizPairsRelaxed,
  hasEnoughTrueFalsePairs,
} from './vocabulary';
import { canSpeak } from './speech';
import { isOralAllowedForSheet, canUseTranslateGame } from './pathSheetType';
import { filterModesByFocus, isModeAllowedByFocus } from './trainingFocus';

const STEP_CYCLE: GameMode[] = ['flashcards', 'type', 'translate', 'quiz', 'match', 'truefalse', 'cloze', 'listen'];

/** 3–4 jeux par leçon, ordre varié (style parcours accumulé). */
const NODE_GAME_TEMPLATES: GameMode[][] = [
  ['flashcards', 'translate', 'match'],
  ['quiz', 'match', 'listen'],
  ['flashcards', 'match', 'truefalse', 'listen'],
  ['translate', 'quiz', 'cloze'],
  ['match', 'flashcards', 'listen', 'truefalse'],
  ['flashcards', 'quiz', 'translate', 'cloze'],
  ['truefalse', 'match', 'listen'],
  ['translate', 'quiz', 'listen'],
];

function listenAvailable(): boolean {
  return typeof window === 'undefined' || canSpeak();
}

function listenPlayable(pairs: WordPair[]): boolean {
  if (!isOralAllowedForSheet()) return false;
  if (!isModeAllowedByFocus('listen')) return false;
  if (!listenAvailable()) return false;
  return hasEnoughQuizPairsRelaxed(coercePlayablePairs(pairs));
}

/** Vocab/notes: keep at least one listening item in the lesson when oral training is on. */
function ensureListenInLesson(games: GameMode[], pairs: WordPair[]): GameMode[] {
  if (games.includes('listen') || !listenPlayable(pairs)) return games;
  if (games.length === 0) return ['listen'];
  const rest = games.filter((g) => g !== 'listen');
  return [rest[0]!, 'listen', ...rest.slice(1)].slice(0, 4);
}

/** Pick a playable mode for this step (fallback if the default cycle mode needs more pairs). */
export function resolveStepMode(preferred: GameMode, pairs: WordPair[]): GameMode {
  const playable = coercePlayablePairs(pairs);
  if (playable.length === 0) return preferred;

  const tryMode = (mode: GameMode): boolean => {
    if (mode === 'listen') {
      return listenPlayable(playable);
    }
    if (mode === 'speak') return false;
    if (mode === 'translate') {
      return canUseTranslateGame(playable);
    }
    if (mode === 'flashcards' || mode === 'type') return playable.length >= 1;
    if (mode === 'quiz' || mode === 'cloze') return hasEnoughQuizPairsRelaxed(playable);
    if (mode === 'truefalse') return hasEnoughTrueFalsePairs(playable);
    if (mode === 'match') return hasEnoughMatchPairs(playable);
    return false;
  };

  if (tryMode(preferred)) return preferred;
  if (tryMode('type')) return 'type';
  if (tryMode('listen')) return 'listen';
  if (tryMode('flashcards')) return 'flashcards';
  if (tryMode('truefalse')) return 'truefalse';
  if (tryMode('cloze')) return 'cloze';
  if (tryMode('quiz')) return 'quiz';
  if (tryMode('match')) return 'match';
  return 'flashcards';
}

export function pickPathStepGames(stepIndex: number, pairs: WordPair[]): GameMode[] {
  const template = NODE_GAME_TEMPLATES[stepIndex % NODE_GAME_TEMPLATES.length];
  const playable = coercePlayablePairs(pairs);
  const seen = new Set<GameMode>();
  const out: GameMode[] = [];

  for (const preferred of template) {
    if (preferred === 'listen' && !isOralAllowedForSheet()) continue;
    if (preferred === 'translate' && !canUseTranslateGame(playable.length > 0 ? playable : pairs)) continue;
    if (!isModeAllowedByFocus(preferred)) continue;
    const mode = resolveStepMode(preferred, playable.length > 0 ? playable : pairs);
    if (!isModeAllowedByFocus(mode)) continue;
    if (!seen.has(mode)) {
      seen.add(mode);
      out.push(mode);
    }
  }

  let filtered = filterModesByFocus(out);
  if (filtered.length >= 2) return ensureListenInLesson(filtered.slice(0, 4), playable.length > 0 ? playable : pairs);

  for (const fallback of STEP_CYCLE) {
    if (filtered.length >= 2) break;
    if (fallback === 'listen' && !isOralAllowedForSheet()) continue;
    if (fallback === 'translate' && !canUseTranslateGame(playable.length > 0 ? playable : pairs)) continue;
    if (!isModeAllowedByFocus(fallback)) continue;
    const mode = resolveStepMode(fallback, playable.length > 0 ? playable : pairs);
    if (!isModeAllowedByFocus(mode)) continue;
    if (!seen.has(mode)) {
      seen.add(mode);
      filtered = filterModesByFocus([...filtered, mode]);
    }
  }

  const filled = filtered.length > 0 ? filtered : filterModesByFocus(['flashcards']);
  return ensureListenInLesson(filled, playable.length > 0 ? playable : pairs);
}

/** @deprecated use pickPathStepGames — kept for exam / legacy single-mode paths. */
export function pickPathStepMode(stepIndex: number, pairs: WordPair[]): GameMode {
  return pickPathStepGames(stepIndex, pairs)[0];
}

export function getNextGameForStep(
  stepIndex: number,
  progress: StepProgressMap,
  pairs: WordPair[],
): GameMode | null {
  const games = pickPathStepGames(stepIndex, pairs);
  const result = progress[stepIndex];

  for (const mode of games) {
    if (!result?.games?.[mode]) return mode;
  }

  for (const mode of games) {
    const sub = result?.games?.[mode];
    if (!sub) return mode;
    if (isTechnicalResult(sub.pct)) continue;
    if (sub.tier !== 'gold') return mode;
  }

  return null;
}

export function getNodeProgressFraction(
  stepIndex: number,
  progress: StepProgressMap,
  pairs: WordPair[],
): number {
  const games = pickPathStepGames(stepIndex, pairs);
  const result = progress[stepIndex];
  if (!result) return 0;

  if (!result.games || Object.keys(result.games).length === 0) {
    return 1;
  }

  const done = games.filter((g) => result.games?.[g]).length;
  return done / games.length;
}

export function getNodeGamesDone(
  stepIndex: number,
  progress: StepProgressMap,
  pairs: WordPair[],
): { done: number; total: number } {
  const games = pickPathStepGames(stepIndex, pairs);
  const result = progress[stepIndex];
  if (!result?.games || Object.keys(result.games).length === 0) {
    return result ? { done: games.length, total: games.length } : { done: 0, total: games.length };
  }
  const done = games.filter((g) => result.games?.[g]).length;
  return { done, total: games.length };
}

export function isNodeAllGold(
  stepIndex: number,
  progress: StepProgressMap,
  pairs: WordPair[],
): boolean {
  const games = pickPathStepGames(stepIndex, pairs);
  const result = progress[stepIndex];
  if (!result) return false;
  if (!result.games || Object.keys(result.games).length === 0) {
    return result.tier === 'gold';
  }
  return games.every((g) => result.games?.[g]?.tier === 'gold');
}

/** Index of the next unfinished mini-game in this node (0 = start). */
export function getResumeGameIndex(
  stepIndex: number,
  progress: StepProgressMap,
  pairs: WordPair[],
): number {
  const games = pickPathStepGames(stepIndex, pairs);
  const next = getNextGameForStep(stepIndex, progress, pairs);
  if (!next) return 0;
  const idx = games.indexOf(next);
  return idx >= 0 ? idx : 0;
}
