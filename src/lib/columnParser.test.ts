import { describe, expect, it } from 'vitest';
import {
  NL_FR_FIXTURE,
  parseColumnText,
  runColumnParserSelfTest,
  reconcileWordListPairs,
} from './columnParser';
import { parseContent } from './parser';

const FR_IN_EN_FIXTURE = `
Quelques mots français dans la langue anglaise
Apéritif\tMachine
Apostrophe\tMetro
Avant-garde\tOccasion
Bon voyage\tPremiere
Champagne\tRestaurant
`.trim();

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

  it('flattens French-in-English word list instead of pairing rows', () => {
    const pairs = parseColumnText(FR_IN_EN_FIXTURE);
    const terms = pairs.map((p) => p.term.toLowerCase());
    expect(terms).toContain('apéritif');
    expect(terms).toContain('machine');
    expect(pairs.some((p) => p.term.toLowerCase() === 'apéritif' && p.definition.toLowerCase() === 'machine')).toBe(
      false,
    );
    expect(pairs.length).toBeGreaterThanOrEqual(8);
  });

  it('reconciles AI-style mistranslated list pairs', () => {
    const bad = [
      { term: 'Apéritif', definition: 'Machine' },
      { term: 'Apostrophe', definition: 'Metro' },
      { term: 'Champagne', definition: 'Restaurant' },
    ];
    const fixed = reconcileWordListPairs(bad, FR_IN_EN_FIXTURE);
    const terms = fixed.map((p) => p.term.toLowerCase());
    expect(terms).toContain('apéritif');
    expect(terms).toContain('machine');
    expect(fixed.some((p) => p.definition === 'Machine')).toBe(false);
  });
});

describe('parser word list integration', () => {
  it('parseContent handles French loanword sheet', () => {
    const pairs = parseContent(FR_IN_EN_FIXTURE, 'vocab');
    expect(pairs.some((p) => p.term.toLowerCase() === 'apéritif' && p.definition === 'Machine')).toBe(false);
    expect(pairs.length).toBeGreaterThanOrEqual(6);
  });
});
