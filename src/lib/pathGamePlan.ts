import type { GameMode, StepProgressMap, WordPair } from '../types';
import { isTechnicalResult } from './stepProgress';
import {
  coercePlayablePairs,
  hasEnoughMatchPairs,
  hasEnoughQuizPairsRelaxed,
  hasEnoughTrueFalsePairs,
} from './vocabulary';
import { canSpeak } from './speech';
import { isOralAllowedForSheet, canUseTranslateGame, getPathSheetType } from './pathSheetType';
import { filterModesByFocus, isModeAllowedByFocus } from './trainingFocus';
import { hasEnoughReorderPairs } from './reorderRounds';
import { hasEnoughListenPickPairs } from './listenPickRounds';
import { hasEnoughDictationPairs } from './dictationRounds';
import { hasEnoughImagePickPairs } from './imagePickRounds';
import { sortByDifficulty } from './gameDifficulty';

const VOCAB_TEMPLATES: GameMode[][] = [
  ['flashcards', 'imagepick', 'translate', 'speak'],
  ['quiz', 'match', 'listen', 'type'],
  ['flashcards', 'match', 'truefalse', 'speak'],
  ['translate', 'imagepick', 'quiz', 'cloze'],
  ['match', 'flashcards', 'listen', 'truefalse'],
  ['quiz', 'imagepick', 'translate', 'speak'],
  ['truefalse', 'match', 'listen', 'dictation'],
  ['listenpick', 'translate', 'quiz', 'listen'],
];

const NOTES_TEMPLATES: GameMode[][] = [
  ['flashcards', 'reorder', 'quiz', 'cloze'],
  ['truefalse', 'listen', 'reorder', 'type'],
  ['flashcards', 'match', 'speak', 'cloze'],
  ['reorder', 'quiz', 'listen', 'type'],
  ['match', 'truefalse', 'reorder', 'speak'],
  ['flashcards', 'cloze', 'listen', 'type'],
  ['quiz', 'reorder', 'truefalse', 'speak'],
  ['reorder', 'match', 'cloze', 'type'],
];

const DEFS_TEMPLATES: GameMode[][] = [
  ['flashcards', 'match', 'quiz', 'type'],
  ['quiz', 'listen', 'match', 'speak'],
  ['flashcards', 'cloze', 'truefalse', 'type'],
  ['match', 'listen', 'quiz', 'speak'],
  ['quiz', 'imagepick', 'cloze', 'type'],
  ['flashcards', 'match', 'listen', 'speak'],
  ['truefalse', 'quiz', 'type', 'cloze'],
  ['match', 'listen', 'truefalse', 'type'],
];

const MATH_TEMPLATES: GameMode[][] = [
  ['flashcards', 'match', 'quiz', 'type'],
  ['quiz', 'reorder', 'cloze', 'type'],
  ['match', 'flashcards', 'listen', 'truefalse'],
  ['reorder', 'quiz', 'type', 'speak'],
  ['flashcards', 'cloze', 'match', 'type'],
  ['quiz', 'reorder', 'listen', 'type'],
  ['match', 'truefalse', 'cloze', 'speak'],
  ['reorder', 'flashcards', 'quiz', 'type'],
];

const FILL_ORDER: GameMode[] = [
  'flashcards',
  'quiz',
  'match',
  'imagepick',
  'type',
  'cloze',
  'truefalse',
  'reorder',
  'listen',
  'speak',
  'translate',
  'listenpick',
  'dictation',
];

function nodeTemplates(): GameMode[][] {
  switch (getPathSheetType()) {
    case 'notes':
      return NOTES_TEMPLATES;
    case 'definitions':
      return DEFS_TEMPLATES;
    case 'math':
      return MATH_TEMPLATES;
    default:
      return VOCAB_TEMPLATES;
  }
}

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

function dictationPlayable(pairs: WordPair[]): boolean {
  if (getPathSheetType() === 'math') return false;
  if (!isOralAllowedForSheet()) return false;
  if (!isModeAllowedByFocus('dictation')) return false;
  if (!listenAvailable()) return false;
  return hasEnoughDictationPairs(coercePlayablePairs(pairs));
}

function listenPickPlayable(pairs: WordPair[]): boolean {
  if (getPathSheetType() === 'math') return false;
  if (!isOralAllowedForSheet()) return false;
  if (!isModeAllowedByFocus('listenpick')) return false;
  if (!listenAvailable()) return false;
  return hasEnoughListenPickPairs(coercePlayablePairs(pairs));
}

function imagePickPlayable(pairs: WordPair[]): boolean {
  if (!isModeAllowedByFocus('imagepick')) return false;
  return hasEnoughImagePickPairs(coercePlayablePairs(pairs));
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

  if (isPlayableMode(preferred, playable)) return preferred;
  if (isPlayableMode('type', playable)) return 'type';
  if (isPlayableMode('listen', playable)) return 'listen';
  if (isPlayableMode('flashcards', playable)) return 'flashcards';
  if (isPlayableMode('truefalse', playable)) return 'truefalse';
  if (isPlayableMode('cloze', playable)) return 'cloze';
  if (isPlayableMode('quiz', playable)) return 'quiz';
  if (isPlayableMode('match', playable)) return 'match';
  return 'flashcards';
}

function isPlayableMode(mode: GameMode, playable: WordPair[]): boolean {
  if (mode === 'listen') return listenPlayable(playable);
  if (mode === 'speak') return speakPlayable(playable);
  if (mode === 'listenpick') return listenPickPlayable(playable);
  if (mode === 'dictation') return dictationPlayable(playable);
  if (mode === 'reorder') return reorderPlayable(playable);
  if (mode === 'translate') return canUseTranslateGame(playable);
  if (mode === 'imagepick') return imagePickPlayable(playable);
  if (mode === 'flashcards' || mode === 'type') return playable.length >= 1;
  if (mode === 'quiz' || mode === 'cloze') return hasEnoughQuizPairsRelaxed(playable);
  if (mode === 'truefalse') return hasEnoughTrueFalsePairs(playable);
  if (mode === 'match') return hasEnoughMatchPairs(playable);
  return false;
}

function fillToFour(games: GameMode[], pairs: WordPair[]): GameMode[] {
  const out = [...games];
  const seen = new Set(out);
  for (const mode of FILL_ORDER) {
    if (out.length >= 4) break;
    if (seen.has(mode)) continue;
    if (ORAL_SLOT_MODES.includes(mode) && !isOralAllowedForSheet()) continue;
    if (!isModeAllowedByFocus(mode)) continue;
    if (!isPlayableMode(mode, pairs)) continue;
    seen.add(mode);
    out.push(mode);
  }
  return out.slice(0, 4);
}

export function pickPathStepGames(stepIndex: number, pairs: WordPair[]): GameMode[] {
  const templates = nodeTemplates();
  const template = templates[stepIndex % templates.length]!;
  const playable = coercePlayablePairs(pairs);
  const source = playable.length > 0 ? playable : pairs;
  const seen = new Set<GameMode>();
  const out: GameMode[] = [];

  for (const preferred of template) {
    if (ORAL_SLOT_MODES.includes(preferred) && !isOralAllowedForSheet()) continue;
    if (preferred === 'translate' && !canUseTranslateGame(source)) continue;
    if (!isModeAllowedByFocus(preferred)) continue;
    if (!isPlayableMode(preferred, source) && preferred !== 'flashcards' && preferred !== 'type') {
      continue;
    }
    const mode = resolveStepMode(preferred, source);
    if (!isModeAllowedByFocus(mode)) continue;
    if (!seen.has(mode)) {
      seen.add(mode);
      out.push(mode);
    }
  }

  let filtered = fillToFour(filterModesByFocus(out), source);
  if (imagePickPlayable(source) && !filtered.includes('imagepick') && isModeAllowedByFocus('imagepick')) {
    const replaceAt = filtered.findIndex((g) => g === 'flashcards' || g === 'quiz');
    if (replaceAt >= 0 && filtered.length >= 4) {
      filtered = filtered.map((g, i) => (i === replaceAt ? 'imagepick' : g));
    } else {
      filtered = fillToFour(['imagepick', ...filtered.filter((g) => g !== 'imagepick')], source);
    }
  }

  const filled = filtered.length > 0 ? filtered : filterModesByFocus(['flashcards']);
  return sortByDifficulty(ensureOralGames(fillToFour(filled, source), source, stepIndex));
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
