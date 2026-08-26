import { describe, expect, it } from 'vitest';
import { buildTrueFalseRounds } from './trueFalseRounds';
import type { WordPair } from '../types';

const pairs: WordPair[] = [
  { term: 'chat', definition: 'kat', quality: 'trusted' },
  { term: 'chien', definition: 'hond', quality: 'trusted' },
  { term: 'oiseau', definition: 'vogel', quality: 'trusted' },
  { term: 'poisson', definition: 'vis', quality: 'trusted' },
];

describe('buildTrueFalseRounds', () => {
  it('balances true and false instead of defaulting to true', () => {
    const rounds = buildTrueFalseRounds(pairs, { maxRounds: 4, random: () => 0.3 });
    expect(rounds.length).toBeGreaterThanOrEqual(2);
    const trues = rounds.filter((r) => r.isTrue).length;
    const falses = rounds.filter((r) => !r.isTrue).length;
    expect(trues).toBeGreaterThan(0);
    expect(falses).toBeGreaterThan(0);
    expect(Math.abs(trues - falses)).toBeLessThanOrEqual(1);
  });

  it('never uses the real definition when the round is false', () => {
    const rounds = buildTrueFalseRounds(pairs, { maxRounds: 4, random: () => 0.1 });
    for (const round of rounds) {
      if (!round.isTrue) {
        expect(round.statement.toLowerCase()).not.toBe(
          pairs.find((p) => p.term === round.term)?.definition.toLowerCase(),
        );
      }
    }
  });
});
