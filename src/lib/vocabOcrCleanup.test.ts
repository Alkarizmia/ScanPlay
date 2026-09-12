import { describe, expect, it } from 'vitest';
import {
  isSheetChromeText,
  normalizeVocabOcrCell,
  unglueEnglishInfinitive,
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
});
