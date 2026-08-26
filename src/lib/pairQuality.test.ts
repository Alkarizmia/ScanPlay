import { describe, expect, it } from 'vitest';
import {
  enrichTeachablePairs,
  isGarbageVocabTerm,
  isPlayableDefinition,
  isSectionTitle,
  isSpellingHintDefinition,
  isTrueFalseSuitable,
} from './pairQuality';
import { fixOcrLine } from './vocabulary';

describe('pairQuality', () => {
  it('rejects spelling hints and title fragments', () => {
    expect(isSpellingHintDefinition('…ritif')).toBe(true);
    expect(isSpellingHintDefinition('…nais')).toBe(true);
    expect(isGarbageVocabTerm('dans la lan')).toBe(true);
    expect(isPlayableDefinition('…itif', 'Apéritif')).toBe(false);
  });

  it('rejects OCR fragments and keeps real translations', () => {
    expect(isGarbageVocabTerm('iologiste')).toBe(true);
    expect(isPlayableDefinition('iologiste', 'alles')).toBe(false);
    expect(isPlayableDefinition('tout', 'alles')).toBe(true);

    const out = enrichTeachablePairs([
      { term: 'alles', definition: 'iologiste' },
      { term: 'audioloog (de)', definition: "l'audiologiste" },
      { term: 'anders', definition: 'autrement' },
    ]);
    expect(out.some((p) => p.term === 'alles' && p.definition === 'iologiste')).toBe(false);
    expect(out.some((p) => /audiologiste/i.test(p.definition))).toBe(true);
    expect(out.some((p) => p.term === 'anders')).toBe(true);
  });

  it('accepts real glosses', () => {
    expect(isPlayableDefinition('Boisson servie avant le repas', 'Apéritif')).toBe(true);
    expect(isPlayableDefinition('honnêtement', 'eerlijk')).toBe(true);
  });

  it('enriches loanwords from glossary', () => {
    const out = enrichTeachablePairs([{ term: 'Apéritif', definition: '…ritif' }]);
    expect(out[0]?.definition).toContain('Boisson');
    expect(out.some((p) => p.term === 'dans la lan')).toBe(false);
  });

  it('rejects section titles and OCR junk', () => {
    expect(isSectionTitle('Le Règne animal')).toBe(true);
    expect(isSectionTitle('Les conjonctions de coordination')).toBe(true);
    expect(isSectionTitle('le fils')).toBe(false);
    expect(isGarbageVocabTerm('ons)')).toBe(true);
    expect(isGarbageVocabTerm('e animal')).toBe(true);
    expect(isGarbageVocabTerm('a baby')).toBe(false);
    expect(isGarbageVocabTerm('to be born')).toBe(false);
    expect(isSectionTitle('la grossesse')).toBe(false);
    expect(isSectionTitle('La Grossesse')).toBe(false);
  });

  it('keeps related vocab that share a word instead of treating them as OCR siblings', () => {
    const out = enrichTeachablePairs([
      { term: 'a baby', definition: 'un bébé' },
      { term: 'a toddler', definition: 'un bébé (qui fait ses premiers pas)' },
    ]);
    expect(out.some((p) => p.term === 'a baby')).toBe(true);
    expect(out.some((p) => p.term === 'a toddler')).toBe(true);
  });

  it('fixes fused articles in OCR lines', () => {
    expect(fixOcrLine('dezoon')).toBe('de zoon');
    expect(fixOcrLine('lefils')).toBe('le fils');
    expect(fixOcrLine('devader')).toBe('de vader');
  });

  it('enables true/false only for translation vocab sheets', () => {
    const nlFr = [
      { term: 'de zoon', definition: 'le fils' },
      { term: 'de vader', definition: 'le père' },
      { term: 'de moeder', definition: 'la mère' },
    ];
    expect(isTrueFalseSuitable(nlFr)).toBe(true);

    const titleOnly = [
      { term: 'Le Règne animal', definition: 'Le Règne animal' },
      { term: 'de zoon', definition: 'Machine' },
    ];
    expect(isTrueFalseSuitable(titleOnly)).toBe(false);
  });

  it('excludes uncertain pairs from true/false', () => {
    const mixed = [
      { term: 'de zoon', definition: 'le fils', quality: 'uncertain' as const },
      { term: 'de vader', definition: 'le père' },
      { term: 'de moeder', definition: 'la mère' },
      { term: 'de broer', definition: 'le frère' },
    ];
    expect(isTrueFalseSuitable(mixed)).toBe(true);
    expect(
      isTrueFalseSuitable(mixed.map((p) => ({ ...p, quality: 'uncertain' as const }))),
    ).toBe(false);
  });
});
