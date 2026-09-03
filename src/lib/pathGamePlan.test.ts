import { beforeEach, describe, expect, it } from 'vitest';
import type { WordPair } from '../types';
import { getNextGameForStep, pickPathStepGames } from './pathGamePlan';
import { TECHNICAL_PCT, mergeSubGameResult } from './stepProgress';
import { setPathSheetType } from './pathSheetType';
import { resetTrainingFocus } from './trainingFocus';

const pairs: WordPair[] = [
  { term: 'beat', definition: 'battre', termLang: 'en', defLang: 'fr' },
  { term: 'run', definition: 'courir', termLang: 'en', defLang: 'fr' },
  { term: 'walk', definition: 'marcher', termLang: 'en', defLang: 'fr' },
  { term: 'jump', definition: 'sauter', termLang: 'en', defLang: 'fr' },
];

const mathPairs: WordPair[] = [
  { term: 'Signe', definition: 'f(x) > 0' },
  { term: 'Domaine', definition: 'R \\ {1}' },
  { term: 'Racines', definition: 'x = ±√2' },
];

describe('getNextGameForStep listen path', () => {
  beforeEach(() => {
    setPathSheetType('vocab');
    resetTrainingFocus();
  });
  it('includes listen in oral lesson templates', () => {
    const games = pickPathStepGames(6, pairs);
    expect(games).toContain('listen');

    let progress = mergeSubGameResult({}, 6, 'listen', TECHNICAL_PCT, pairs);
    for (const mode of games) {
      if (mode === 'listen') continue;
      progress = mergeSubGameResult(progress, 6, mode, 100, pairs);
    }

    expect(getNextGameForStep(6, progress, pairs)).toBeNull();
  });

  it('still offers unfinished games before advancing', () => {
    const games = pickPathStepGames(6, pairs);
    const other = games.find((g) => g !== 'listen');
    expect(other).toBeTruthy();

    const progress = mergeSubGameResult({}, 6, 'listen', TECHNICAL_PCT, pairs);
    expect(getNextGameForStep(6, progress, pairs)).toBe(other);
  });

  it('includes translate on vocab path nodes', () => {
    const games = pickPathStepGames(0, pairs);
    expect(games).toContain('translate');
  });

  it('includes listen on the first vocab node when oral training is on', () => {
    expect(pickPathStepGames(0, pairs)).toContain('listen');
  });

  it('includes speak pronunciation on vocab when oral training is on', () => {
    expect(pickPathStepGames(0, pairs)).toContain('speak');
    expect(pickPathStepGames(6, pairs)).toContain('speak');
  });

  it('lets math lessons hear the formula name, never latex dictation', () => {
    setPathSheetType('math');
    const games = pickPathStepGames(0, mathPairs);
    expect(games).not.toContain('translate');
    expect(games).not.toContain('listenpick');
    expect(games).not.toContain('dictation');
    expect(games.length).toBe(4);
  });

  it('never puts translate on a math sheet', () => {
    setPathSheetType('math');
    expect(pickPathStepGames(0, mathPairs).join(',')).not.toContain('translate');
    setPathSheetType('vocab');
    expect(pickPathStepGames(0, mathPairs)).not.toContain('translate');
  });
});
