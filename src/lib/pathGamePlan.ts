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
import { hasEnoughReorderPairs } from './reorderRounds';
import { hasEnoughListenPickPairs } from './listenPickRounds';
import { hasEnoughDictationPairs } from './dictationRounds';
import { sortByDifficulty } from './gameDifficulty';

const STEP_CYCLE: GameMode[] = ['flashcards', 'type', 'translate', 'quiz', 'match', 'truefalse', 'cloze', 'reorder', 'listen', 'speak'];

/** 3–4 jeux par leçon, ordre varié (style parcours accumulé). */
const NODE_GAME_TEMPLATES: GameMode[][] = [
  ['flashcards', 'translate', 'speak'],
  ['quiz', 'match', 'listen'],
  ['flashcards', 'match', 'truefalse', 'speak'],
  ['translate', 'reorder', 'quiz', 'cloze'],
  ['match', 'flashcards', 'listen', 'truefalse'],
  ['flashcards', 'quiz', 'translate', 'speak'],
  ['truefalse', 'match', 'listen'],
  ['reorder', 'translate', 'quiz', 'listen'],
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

function speakPlayable(pairs: WordPair[]): boolean {
  if (!isOralAllowedForSheet()) return false;
  if (!isModeAllowedByFocus('speak')) return false;
  return coercePlayablePairs(pairs).length >= 1;
}

function listenPickPlayable(pairs: WordPair[]): boolean {
  if (!isOralAllowedForSheet()) return false;
  if (!isModeAllowedByFocus('listenpick')) return false;
  if (!listenAvailable()) return false;
  return hasEnoughListenPickPairs(coercePlayablePairs(pairs));
}

function dictationPlayable(pairs: WordPair[]): boolean {
  if (!isOralAllowedForSheet()) return false;
  if (!isModeAllowedByFocus('dictation')) return false;
  if (!listenAvailable()) return false;
  return hasEnoughDictationPairs(coercePlayablePairs(pairs));
}

function reorderPlayable(pairs: WordPair[]): boolean {
  if (!isModeAllowedByFocus('reorder')) return false;
  return hasEnoughReorderPairs(coercePlayablePairs(pairs));
}

const ORAL_SLOT_MODES: GameMode[] = ['listen', 'speak', 'listenpick', 'dictation'];

/**
 * When oral training is on: keep two oral games per lesson (vocab/notes only).
 * Odd nodes swap in the harder ear games so the ear work also progresses
 * from "recognise a meaning" to "spell what you heard".
 */
function ensureOralGames(games: GameMode[], pairs: WordPair[], stepIndex = 0): GameMode[] {
  const written = games.filter((g) => !ORAL_SLOT_MODES.includes(g));
  const harder = stepIndex % 2 === 1;

  const oral: GameMode[] = [];
  if (harder && listenPickPlayable(pairs)) oral.push('listenpick');
  else if (listenPlayable(pairs)) oral.push('listen');

  if (harder && dictationPlayable(pairs)) oral.push('dictation');
  else if (speakPlayable(pairs)) oral.push('speak');

  if (oral.length === 0) return games.slice(0, 4);

  const mixed: GameMode[] = [];
  if (written[0]) mixed.push(written[0]);
  for (const g of oral) {
    if (!mixed.includes(g)) mixed.push(g);
  }
  for (const g of written.slice(1)) {
    if (mixed.length >= 4) break;
    if (!mixed.includes(g)) mixed.push(g);
  }
  return mixed.slice(0, 4);
}

/** Pick a playable mode for this step (fallback if the default cycle mode needs more pairs). */
export function resolveStepMode(preferred: GameMode, pairs: WordPair[]): GameMode {
  const playable = coercePlayablePairs(pairs);
  if (playable.length === 0) return preferred;

  const tryMode = (mode: GameMode): boolean => {
    if (mode === 'listen') {
      return listenPlayable(playable);
    }
    if (mode === 'speak') {
      return speakPlayable(playable);
    }
    if (mode === 'listenpick') {
      return listenPickPlayable(playable);
    }
    if (mode === 'dictation') {
      return dictationPlayable(playable);
    }
    if (mode === 'reorder') {
      return reorderPlayable(playable);
    }
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
    if (ORAL_SLOT_MODES.includes(preferred) && !isOralAllowedForSheet()) continue;
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
  if (filtered.length >= 2) {
    return sortByDifficulty(
      ensureOralGames(filtered.slice(0, 4), playable.length > 0 ? playable : pairs, stepIndex),
    );
  }

  for (const fallback of STEP_CYCLE) {
    if (filtered.length >= 2) break;
    if (ORAL_SLOT_MODES.includes(fallback) && !isOralAllowedForSheet()) continue;
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
  return sortByDifficulty(
    ensureOralGames(filled, playable.length > 0 ? playable : pairs, stepIndex),
  );
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
