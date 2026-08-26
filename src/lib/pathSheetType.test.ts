import { describe, expect, it } from 'vitest';
import { canUseTranslateGame, inferColumnLangs } from './pathSheetType';
import type { WordPair } from '../types';

describe('canUseTranslateGame', () => {
  it('allows NL→FR vocab lists', () => {
    const pairs: WordPair[] = [
      { term: 'auto', definition: 'voiture', termLang: 'nl', defLang: 'fr' },
      { term: 'fiets', definition: 'vélo', termLang: 'nl', defLang: 'fr' },
    ];
    expect(canUseTranslateGame(pairs, 'vocab')).toBe(true);
    expect(inferColumnLangs(pairs)).toEqual({ term: 'nl', def: 'fr' });
  });

  it('allows EN→FR when that is what is on the sheet', () => {
    const pairs: WordPair[] = [
      { term: 'pencil', definition: 'crayon', termLang: 'en', defLang: 'fr' },
    ];
    expect(canUseTranslateGame(pairs, 'vocab')).toBe(true);
  });

  it('blocks maths even if the sheet was saved as vocab', () => {
    const pairs: WordPair[] = [
      { term: 'Signe', definition: 'f(x) > 0' },
      { term: 'Domaine', definition: '\\mathbb{R} \\setminus \\{1\\}' },
    ];
    expect(canUseTranslateGame(pairs, 'vocab')).toBe(false);
    expect(canUseTranslateGame(pairs, 'math')).toBe(false);
  });

  it('blocks same-language French notes', () => {
    const pairs: WordPair[] = [
      { term: 'Domaine', definition: 'ensemble de definition', termLang: 'fr', defLang: 'fr' },
    ];
    expect(canUseTranslateGame(pairs, 'vocab')).toBe(false);
  });
});
