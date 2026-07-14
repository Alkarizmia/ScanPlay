import { describe, expect, it } from 'vitest';
import {
  NL_FR_FIXTURE,
  parseColumnText,
  runColumnParserSelfTest,
  reconcileWordListPairs,
  splitLineIntoColumns,
} from './columnParser';
import { parseContent } from './parser';
import { fixOcrLine } from './vocabulary';

const FR_IN_EN_FIXTURE = `
Quelques mots français dans la langue anglaise
Apéritif\tMachine
Apostrophe\tMetro
Avant-garde\tOccasion
Bon voyage\tPremiere
Champagne\tRestaurant
`.trim();

const NL_FR_SHEET = `
Le Règne animal – Woordenschat NL – FR
de vader\tle père
de zoon\tle fils
de moeder\tla mère
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

  it('parses arrow-separated rows and skips chapter titles', () => {
    const cols = splitLineIntoColumns('en -> et');
    expect(cols).toEqual(['en', 'et']);

    const pairs = parseColumnText(NL_FR_SHEET);
    const terms = pairs.map((p) => p.term.toLowerCase());
    expect(terms).toContain('de vader');
    expect(terms).toContain('de zoon');
    expect(pairs.some((p) => /règne animal/i.test(p.term))).toBe(false);
  });

  it('flattens French-in-English word list with teachable glosses', () => {
    const pairs = parseColumnText(FR_IN_EN_FIXTURE);
    const terms = pairs.map((p) => p.term.toLowerCase());
    expect(terms).toContain('apéritif');
    expect(terms).toContain('machine');
    expect(pairs.some((p) => p.term.toLowerCase() === 'apéritif' && p.definition.startsWith('…'))).toBe(
      false,
    );
    expect(pairs.find((p) => p.term.toLowerCase() === 'apéritif')?.definition).toContain('Boisson');
    expect(pairs.length).toBeGreaterThanOrEqual(8);
  });

  it('reconciles AI-style mistranslated list pairs', () => {
    const bad = [
      { term: 'Apéritif', definition: 'Machine' },
      { term: 'Apostrophe', definition: 'Metro' },
      { term: 'Champagne', definition: 'Restaurant' },
    ];
    const fixed = reconcileWordListPairs(bad, FR_IN_EN_FIXTURE);
    const ap = fixed.find((p) => p.term.toLowerCase() === 'apéritif');
    expect(ap?.definition).not.toBe('Machine');
    expect(ap?.definition.length).toBeGreaterThan(10);
  });

  it('normalizes fused OCR tokens before parsing', () => {
    const pairs = parseColumnText(`${fixOcrLine('dezoon')}\t${fixOcrLine('lefils')}`);
    expect(pairs[0]?.term).toBe('de zoon');
    expect(pairs[0]?.definition).toBe('le fils');
  });
});

describe('parser word list integration', () => {
  it('parseContent handles French loanword sheet', () => {
    const pairs = parseContent(FR_IN_EN_FIXTURE, 'vocab');
    expect(pairs.some((p) => p.term.toLowerCase() === 'apéritif' && p.definition === 'Machine')).toBe(false);
    expect(pairs.length).toBeGreaterThanOrEqual(6);
  });
});
