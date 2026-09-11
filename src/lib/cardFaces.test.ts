import { describe, expect, it } from 'vitest';
import { getCardSides, hasMultiFaceCard, normalizeFaces } from './cardFaces';

describe('cardFaces', () => {
  it('builds term → faces → definition order', () => {
    expect(
      getCardSides({
        term: 'kunnen',
        faces: ['kon', 'konden', 'gekund'],
        definition: 'pouvoir',
      }),
    ).toEqual(['kunnen', 'kon', 'konden', 'gekund', 'pouvoir']);
  });

  it('dedupes and ignores empty faces', () => {
    expect(
      getCardSides({
        term: 'zijn',
        faces: ['was', 'was', ''],
        definition: 'être',
      }),
    ).toEqual(['zijn', 'was', 'être']);
  });

  it('detects multi-face cards', () => {
    expect(hasMultiFaceCard({ term: 'a', definition: 'b' })).toBe(false);
    expect(hasMultiFaceCard({ term: 'a', faces: ['b'], definition: 'c' })).toBe(true);
  });

  it('normalizes AI faces arrays', () => {
    expect(normalizeFaces([' kon ', '', 3, 'konden'])).toEqual(['kon', 'konden']);
    expect(normalizeFaces([])).toBeUndefined();
  });
});
