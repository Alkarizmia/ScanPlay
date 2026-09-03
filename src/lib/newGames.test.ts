import { beforeEach, describe, expect, it } from 'vitest';
import type { WordPair } from '../types';
import { buildListenPickRounds, hasEnoughListenPickPairs } from './listenPickRounds';
import { buildReorderRounds, hasEnoughReorderPairs } from './reorderRounds';
import { buildImagePickRounds, hasEnoughImagePickPairs } from './imagePickRounds';
import { buildDictationRounds, getDictationPool, hasEnoughDictationPairs } from './dictationRounds';
import { splitVocabAlternatives } from './vocabTokens';
import { getModeDifficulty, sortByDifficulty } from './gameDifficulty';
import { pickPathStepGames } from './pathGamePlan';
import { setPathSheetType } from './pathSheetType';
import { resetTrainingFocus, setTrainingFocus } from './trainingFocus';
import { fixOcrLine, repairSplitArticle } from './vocabulary';

describe('vocab alternative lists', () => {
  it('splits comma lists that are not sentences', () => {
    expect(splitVocabAlternatives('défi, difficultés')).toEqual(['défi', 'difficultés']);
    expect(splitVocabAlternatives('the cat sleeps on the mat.')).toEqual(['the cat sleeps on the mat.']);
  });
});

describe('article splitting', () => {
  it('keeps real articles intact', () => {
    expect(fixOcrLine('Appliquer une théorie')).toBe('Appliquer une théorie');
    expect(fixOcrLine('Une théorie')).toBe('Une théorie');
    expect(fixOcrLine('Voici la compétence')).toBe('Voici la compétence');
  });

  it('still splits fused articles', () => {
    expect(fixOcrLine('dezoon van')).toBe('de zoon van');
    expect(fixOcrLine('lefils')).toBe('le fils');
  });

  it('repairs decks scanned before the fix', () => {
    expect(repairSplitArticle('Appliquer un e théorie')).toBe('Appliquer une théorie');
    expect(repairSplitArticle('de s maisons')).toBe('des maisons');
  });
});

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

  it('skips single-word vocab', () => {
    expect(hasEnoughReorderPairs(vocabPairs)).toBe(false);
  });

  it('rebuilds a formula from bricks', () => {
    const rounds = buildReorderRounds(
      [
        { term: 'Aire du cercle', definition: 'π × r^2' },
        { term: 'Newton', definition: 'F = m × a' },
      ],
      { maxRounds: 2, seed: 'math' },
    );
    expect(rounds).toHaveLength(2);
    expect(rounds[0]?.expected).toEqual(['π', '×', 'r', '^', '2']);
    expect(rounds[0]?.clue).toBe('Aire du cercle');
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
      expect(round.spoken).not.toBe(round.target);
      expect(round.options).not.toContain(round.spoken);
    }
  });

  it('hears English then picks French, then the reverse', () => {
    const rounds = buildListenPickRounds(vocabPairs, { maxRounds: 2, seed: 'test' });
    expect(rounds[0]?.spoken).toBe('beat');
    expect(rounds[0]?.target).toBe('battre');
    expect(rounds[0]?.lang).toBe('en');
    expect(rounds[1]?.spoken).toBe('haricot');
    expect(rounds[1]?.target).toBe('bean');
    expect(rounds[1]?.lang).toBe('fr');
  });

  it('needs at least four short bilingual words', () => {
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
      { term: 'walk', definition: 'marcher', termLang: 'en', defLang: 'fr' },
    ]).map((p) => p.term);

    expect(terms).toEqual(['walk']);
  });

  it('speaks one language and asks to write the other', () => {
    const rounds = buildDictationRounds(vocabPairs, { maxRounds: 2, seed: 'test', sheetType: 'vocab' });
    expect(rounds[0]?.spoken).toBe('beat');
    expect(rounds[0]?.accepted).toEqual(['battre']);
    expect(rounds[0]?.lang).toBe('en');
    expect(rounds[1]?.spoken).toBe('haricot');
    expect(rounds[1]?.accepted).toEqual(['bean']);
    expect(rounds[1]?.lang).toBe('fr');
  });

  it('accepts either word from a scanned comma list', () => {
    const rounds = buildDictationRounds(
      [
        { term: 'challenge', definition: 'défi, difficultés', termLang: 'en', defLang: 'fr' },
        { term: 'growth', definition: 'croissance', termLang: 'en', defLang: 'fr' },
      ],
      { maxRounds: 1, seed: 'list', sheetType: 'vocab' },
    );
    expect(rounds[0]?.spoken).toBe('challenge');
    expect(rounds[0]?.accepted).toEqual(['défi', 'difficultés']);
  });
});

describe('image pick rounds', () => {
  it('asks for the picture of a scanned word', () => {
    const rounds = buildImagePickRounds(
      [
        { term: 'apple', definition: 'pomme', termLang: 'en', defLang: 'fr' },
        { term: 'run', definition: 'courir', termLang: 'en', defLang: 'fr' },
      ],
      { maxRounds: 1, seed: 'pic' },
    );
    expect(rounds[0]?.prompt.toLowerCase()).toMatch(/apple|pomme/);
    expect(rounds[0]?.options).toHaveLength(4);
    expect(rounds[0]?.options.some((art) => art.id === 'pomme')).toBe(true);
  });

  it('needs a known everyday word', () => {
    expect(hasEnoughImagePickPairs(vocabPairs)).toBe(false);
    expect(
      hasEnoughImagePickPairs([{ term: 'car', definition: 'voiture', termLang: 'en', defLang: 'fr' }]),
    ).toBe(true);
  });

  it('links scanned verbs to the matching picture', () => {
    expect(buildImagePickRounds([{ term: 'to read', definition: 'lire' }], { maxRounds: 1 })[0]?.targetId).toBe(
      'livre',
    );
    expect(buildImagePickRounds([{ term: 'boire', definition: 'to drink' }], { maxRounds: 1 })[0]?.targetId).toBe(
      'eau',
    );
    expect(
      buildImagePickRounds([{ term: 'conduire', definition: 'to drive' }], { maxRounds: 1 })[0]?.targetId,
    ).toBe('voiture');
    expect(buildImagePickRounds([{ term: 'dog', definition: 'chien' }], { maxRounds: 1 })[0]?.targetId).toBe(
      'chien',
    );
    expect(buildImagePickRounds([{ term: 'avion', definition: 'plane' }], { maxRounds: 1 })[0]?.targetId).toBe(
      'avion',
    );
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

  it('keeps word bricks on notes when training oral', () => {
    setPathSheetType('notes');
    setTrainingFocus(['written', 'oral']);
    expect(pickPathStepGames(2, notesPairs)).toContain('reorder');
  });

  it('keeps four games on notes and math lessons', () => {
    setPathSheetType('notes');
    expect(pickPathStepGames(0, notesPairs).length).toBe(4);
    setPathSheetType('math');
    expect(pickPathStepGames(0, mathPairs).length).toBe(4);
    setPathSheetType('vocab');
  });

  it('never puts oral or picture games on a math sheet', () => {
    setPathSheetType('math');
    for (const step of [0, 1, 2, 3, 6]) {
      const games = pickPathStepGames(step, mathPairs);
      expect(games).not.toContain('listen');
      expect(games).not.toContain('speak');
      expect(games).not.toContain('listenpick');
      expect(games).not.toContain('dictation');
      expect(games).not.toContain('imagepick');
    }
  });

  it('never puts reorder on a sheet without sentences', () => {
    for (const step of [0, 1, 2, 3, 7]) {
      expect(pickPathStepGames(step, vocabPairs)).not.toContain('reorder');
    }
  });
});
