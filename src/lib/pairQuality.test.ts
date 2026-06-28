import { describe, expect, it } from 'vitest';
import {
  enrichTeachablePairs,
  isGarbageVocabTerm,
  isPlayableDefinition,
  isSpellingHintDefinition,
} from './pairQuality';

describe('pairQuality', () => {
  it('rejects spelling hints and title fragments', () => {
    expect(isSpellingHintDefinition('…ritif')).toBe(true);
    expect(isSpellingHintDefinition('…nais')).toBe(true);
    expect(isGarbageVocabTerm('dans la lan')).toBe(true);
    expect(isPlayableDefinition('…itif', 'Apéritif')).toBe(false);
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
});
