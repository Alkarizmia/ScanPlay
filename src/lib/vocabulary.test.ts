import { describe, expect, it } from 'vitest';
import {
  gradeTypedAnswer,
  isLongExpectedAnswer,
  pickTypeGameOptions,
} from './vocabulary';
import type { WordPair } from '../types';

describe('isLongExpectedAnswer', () => {
  it('detects long definitions', () => {
    expect(
      isLongExpectedAnswer('Investissements par négociants dans le transport maritime'),
    ).toBe(true);
    expect(isLongExpectedAnswer('chat')).toBe(false);
  });
});

describe('gradeTypedAnswer semantic', () => {
  const expected = 'Investissements par négociants dans le transport maritime';

  it('rejects nonsense single letters', () => {
    expect(gradeTypedAnswer('U', expected)).toBe('wrong');
  });

  it('accepts key concepts without full sentence', () => {
    expect(gradeTypedAnswer('investissements négociants transport maritime', expected)).toBe('correct');
  });

  it('gives partial credit for some keywords', () => {
    expect(gradeTypedAnswer('transport maritime', expected)).toBe('near');
  });

  it('still accepts exact match', () => {
    expect(gradeTypedAnswer(expected, expected)).toBe('correct');
  });
});

describe('gradeTypedAnswer math', () => {
  const expected = "(f + g)' = f' + g'";

  it('accepts RHS without spaces', () => {
    expect(gradeTypedAnswer("f'+g'", expected, true)).toBe('correct');
  });

  it('accepts RHS with spaces', () => {
    expect(gradeTypedAnswer("f' + g'", expected, true)).toBe('correct');
  });

  it('accepts full equation without spaces', () => {
    expect(gradeTypedAnswer("(f+g)'=f'+g'", expected, true)).toBe('correct');
  });

  it('accepts middle-dot multiplication like × or *', () => {
    const productRule = "(f · g)' = f' · g + f · g'";
    expect(gradeTypedAnswer("f'×g+f×g'", productRule, true)).toBe('correct');
    expect(gradeTypedAnswer("f'*g+f*g'", productRule, true)).toBe('correct');
    expect(gradeTypedAnswer("f'·g+f·g'", productRule, true)).toBe('correct');
  });
});

describe('pickTypeGameOptions', () => {
  const pool: WordPair[] = [
    { term: 'A', definition: 'Investissements par négociants dans le transport maritime' },
    { term: 'B', definition: 'Commerce des esclaves transatlantique' },
    { term: 'C', definition: 'Révolution industrielle en Angleterre' },
    { term: 'D', definition: 'Système féodal européen' },
  ];

  it('returns four shuffled options when pool allows', () => {
    const options = pickTypeGameOptions(pool[0], pool, 3, 'test-seed');
    expect(options).toHaveLength(4);
    expect(options).toContain(pool[0].definition);
  });
});
