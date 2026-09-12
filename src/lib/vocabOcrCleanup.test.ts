import { describe, expect, it } from 'vitest';
import {
  expandMisalignedRowPairs,
  isFusedRowPair,
  isSheetChromeText,
  normalizeVocabOcrCell,
  sanitizeVocabExtractPairs,
  splitFusedEnFrRow,
  unglueEnglishInfinitive,
  vocabTermDedupeKey,
} from './vocabOcrCleanup';
import { isGarbageVocabTerm, isPlayableDefinition } from './pairQuality';

describe('vocabOcrCleanup', () => {
  it('unglues To+verb OCR fusions', () => {
    expect(unglueEnglishInfinitive('Tobe')).toBe('To be');
    expect(unglueEnglishInfinitive('Tosee')).toBe('To see');
    expect(unglueEnglishInfinitive('Totry')).toBe('To try');
    expect(unglueEnglishInfinitive('Totake')).toBe('To take');
    expect(normalizeVocabOcrCell('To le ave', 'term')).toBe('To leave');
  });

  it('drops sheet chrome / titles', () => {
    expect(isSheetChromeText('25 verbes basiques en anglais')).toBe(true);
    expect(isSheetChromeText('Anglais')).toBe(true);
    expect(isGarbageVocabTerm('025 verbes basiques en anglais)')).toBe(true);
  });

  it('keeps short To-infinitive → FR cards playable', () => {
    expect(isPlayableDefinition('être', 'To be')).toBe(true);
    expect(isPlayableDefinition('avoir', 'To have')).toBe(true);
    expect(isPlayableDefinition('demander', 'To ask')).toBe(true);
  });

  it('splits fused EN+FR row cells', () => {
    expect(splitFusedEnFrRow('To know savoir')).toEqual({
      term: 'To know',
      definition: 'savoir',
    });
    expect(splitFusedEnFrRow('To seem sembler')).toEqual({
      term: 'To seem',
      definition: 'sembler',
    });
  });

  it('repairs consecutive full-row mispairs at sheet bottom', () => {
    expect(isFusedRowPair('To seem sembler', 'To feel se sentir')).toBe(true);
    const fixed = expandMisalignedRowPairs([
      {
        term: 'To seem sembler',
        definition: 'To feel se sentir',
        termLang: 'en',
        defLang: 'fr',
      },
    ]);
    expect(fixed).toHaveLength(2);
    expect(fixed[0]).toMatchObject({ term: 'To seem', definition: 'sembler' });
    expect(fixed[1]).toMatchObject({ term: 'To feel', definition: 'se sentir' });
  });

  it('dedupes To seem vs To seem sembler and sanitizes mash rows', () => {
    expect(vocabTermDedupeKey('To seem sembler')).toBe('to seem');
    expect(vocabTermDedupeKey('To seem')).toBe('to seem');
    const cleaned = sanitizeVocabExtractPairs([
      { term: 'To seem', definition: 'sembler', termLang: 'en', defLang: 'fr' },
      { term: 'To seem sembler', definition: 'To feel se sentir', termLang: 'en', defLang: 'fr' },
      { term: 'To feel', definition: 'se sentir', termLang: 'en', defLang: 'fr' },
    ]);
    expect(cleaned.map((p) => p.term)).toEqual(['To seem', 'To feel']);
    expect(cleaned).toHaveLength(2);
  });
});
