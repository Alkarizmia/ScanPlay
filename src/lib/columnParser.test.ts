import { describe, expect, it } from 'vitest';
import { NL_FR_FIXTURE, parseColumnText, runColumnParserSelfTest } from './columnParser';

describe('columnParser', () => {
  it('parses NL↔FR fixture with at least 10 pairs', () => {
    const pairs = parseColumnText(NL_FR_FIXTURE);
    expect(pairs.length).toBeGreaterThanOrEqual(10);
    const terms = pairs.map((p) => p.term.toLowerCase());
    expect(terms.some((t) => t.includes('eerlijk'))).toBe(true);
    expect(terms.some((t) => t.includes('ervaring'))).toBe(true);
    expect(terms.some((t) => t.includes('gek'))).toBe(true);
    expect(terms.some((t) => t.includes('intussen'))).toBe(true);
  });

  it('self-test passes', () => {
    const result = runColumnParserSelfTest();
    expect(result.ok).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(10);
  });

  it('assigns NL term and FR definition', () => {
    const pairs = parseColumnText('eerlijk\thonnêtement');
    expect(pairs[0]?.termLang).toBe('nl');
    expect(pairs[0]?.defLang).toBe('fr');
  });
});
