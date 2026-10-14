import { describe, expect, it } from 'vitest';
import { applyPairCertainty, inferPairQuality, looksLikeScienceDefinitionPair } from './pairCertainty';

describe('pairCertainty', () => {
  it('marks incomplete vocab sides as uncertain', () => {
    expect(inferPairQuality({ term: '', definition: 'je suis' })).toBe('uncertain');
    expect(inferPairQuality({ term: 'but', definition: 'pourquoi' })).toBe('trusted');
  });

  it('treats science definitions without bilingual rules', () => {
    expect(
      looksLikeScienceDefinitionPair(
        'Photosynthèse',
        'Processus par lequel les plantes transforment la lumière en énergie chimique.',
      ),
    ).toBe(true);
    expect(
      inferPairQuality(
        {
          term: 'Photosynthèse',
          definition: 'Processus par lequel les plantes transforment la lumière en énergie chimique.',
        },
        'definitions',
      ),
    ).toBe('trusted');
  });

  it('flags truncated math formulas as uncertain without touching science prose', () => {
    expect(
      inferPairQuality({ term: "f'(x)", definition: '\\frac{1}{2' }, 'math'),
    ).toBe('uncertain');
    expect(
      inferPairQuality(
        {
          term: 'Cellule',
          definition: 'Unité de base du vivant, avec un noyau et un cytoplasme.',
        },
        'definitions',
      ),
    ).toBe('trusted');
  });

  it('keeps explicit uncertain marks', () => {
    const out = applyPairCertainty([
      { term: 'But', definition: 'mais', quality: 'uncertain' },
      { term: 'I am', definition: 'je suis', quality: 'trusted' },
    ]);
    expect(out[0]?.quality).toBe('uncertain');
    expect(out[1]?.quality).toBe('trusted');
  });
});
