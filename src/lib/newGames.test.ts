import { beforeEach, describe, expect, it } from 'vitest';
import type { WordPair } from '../types';
import { buildListenPickRounds, hasEnoughListenPickPairs } from './listenPickRounds';
import { buildReorderRounds, hasEnoughReorderPairs } from './reorderRounds';
import { getDictationPool, hasEnoughDictationPairs } from './dictationRounds';
import { getModeDifficulty, sortByDifficulty } from './gameDifficulty';
import { pickPathStepGames } from './pathGamePlan';
import { setPathSheetType } from './pathSheetType';
import { resetTrainingFocus, setTrainingFocus } from './trainingFocus';

const vocabPairs: WordPair[] = [
  { term: 'beat', definition: 'battre', termLang: 'en', defLang: 'fr' },
  { term: 'bean', definition: 'haricot', termLang: 'en', defLang: 'fr' },
  { term: 'run', definition: 'courir', termLang: 'en', defLang: 'fr' },
  { term: 'walk', definition: 'marcher', termLang: 'en', defLang: 'fr' },
  { term: 'jump', definition: 'sauter', termLang: 'en', defLang: 'fr' },
];

const notesPairs: WordPair[] = [
  { term: 'Révolution française', definition: 'elle commence en mille sept cent quatre vingt neuf' },
  { term: 'Photosynthèse', definition: 'la plante transforme la lumiere en energie' },
  { term: 'Gravité', definition: 'les corps massifs attirent les autres corps' },
];

const mathPairs: WordPair[] = [
  { term: 'Signe', definition: 'f(x) > 0' },
  { term: 'Domaine', definition: 'R \\ {1}' },
  { term: 'Racines', definition: 'x = ±√2' },
];

describe('reorder rounds', () => {
  it('builds a scrambled sentence from a notes sheet', () => {
    const rounds = buildReorderRounds(notesPairs, { maxRounds: 3 });
    expect(rounds.length).toBeGreaterThanOrEqual(2);

    for (const round of rounds) {
      expect(round.expected.length).toBeGreaterThanOrEqual(4);
      expect(round.tiles).toHaveLength(round.expected.length);
      expect([...round.tiles].map((t) => t.text).sort()).toEqual([...round.expected].sort());
      expect(round.tiles.map((t) => t.text)).not.toEqual(round.expected);
    }
  });

  it('skips single-word and math pairs', () => {
    expect(hasEnoughReorderPairs(vocabPairs)).toBe(false);
    expect(hasEnoughReorderPairs(mathPairs)).toBe(false);
  });
});

describe('listen discrimination rounds', () => {
  it('offers four options including the spoken word', () => {
    const rounds = buildListenPickRounds(vocabPairs, { maxRounds: 3, seed: 'test' });
    expect(rounds.length).toBeGreaterThanOrEqual(2);

    for (const round of rounds) {
      expect(round.options).toHaveLength(4);
      expect(round.options).toContain(round.target);
      expect(new Set(round.options).size).toBe(4);
    }
  });

  it('prefers look-alike distractors', () => {
    const round = buildListenPickRounds(vocabPairs, { maxRounds: 1, seed: 'test' })[0];
    expect(round?.target).toBe('beat');
    expect(round?.options).toContain('bean');
  });

  it('needs at least four short words', () => {
    expect(hasEnoughListenPickPairs(vocabPairs.slice(0, 2))).toBe(false);
    expect(hasEnoughListenPickPairs(notesPairs)).toBe(false);
  });
});

describe('dictation pool', () => {
  it('keeps short spellable terms only', () => {
    expect(hasEnoughDictationPairs(vocabPairs)).toBe(true);
    expect(getDictationPool(vocabPairs).map((p) => p.term)).toContain('walk');
  });

  it('drops formulas and long phrases you cannot spell back', () => {
    const terms = getDictationPool([
      { term: 'x = 2y + 1', definition: 'équation de la droite' },
      { term: 'une très longue phrase que personne ne peut réécrire', definition: 'trop long' },
      { term: 'walk', definition: 'marcher' },
    ]).map((p) => p.term);

    expect(terms).toEqual(['walk']);
  });
});

describe('difficulty scale', () => {
  it('rates production above recognition', () => {
    expect(getModeDifficulty('quiz')).toBeLessThan(getModeDifficulty('type'));
    expect(getModeDifficulty('flashcards')).toBeLessThan(getModeDifficulty('speak'));
  });

  it('warms up before asking for production', () => {
    expect(sortByDifficulty(['type', 'quiz', 'match'])).toEqual(['quiz', 'match', 'type']);
  });

  it('keeps the original order for equal levels', () => {
    expect(sortByDifficulty(['truefalse', 'quiz'])).toEqual(['truefalse', 'quiz']);
  });
});

describe('new modes in the path', () => {
  beforeEach(() => {
    setPathSheetType('vocab');
    resetTrainingFocus();
  });

  it('reaches the ear games on odd nodes when training oral', () => {
    setTrainingFocus(['oral']);
    const games = pickPathStepGames(1, vocabPairs);
    expect(games).toContain('listenpick');
    expect(games).toContain('dictation');
  });

  it('keeps listen and speak on even nodes', () => {
    setTrainingFocus(['oral']);
    const games = pickPathStepGames(0, vocabPairs);
    expect(games).toContain('listen');
    expect(games).toContain('speak');
  });

  it('offers reorder on a notes sheet when training written', () => {
    setPathSheetType('notes');
    setTrainingFocus(['written']);
    expect(pickPathStepGames(3, notesPairs)).toContain('reorder');
  });

  it('never puts the audio games on a math sheet', () => {
    setPathSheetType('math');
    for (const step of [0, 1, 2, 3]) {
      const games = pickPathStepGames(step, mathPairs);
      expect(games).not.toContain('listenpick');
      expect(games).not.toContain('dictation');
    }
  });

  it('never puts reorder on a sheet without sentences', () => {
    for (const step of [0, 1, 2, 3, 7]) {
      expect(pickPathStepGames(step, vocabPairs)).not.toContain('reorder');
    }
  });
});
