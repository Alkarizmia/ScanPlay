import { describe, expect, it } from 'vitest';
import { buildHistoryTitle, detectHistorySubject } from './historySubject';

describe('detectHistorySubject', () => {
  it('detects math from sheet type', () => {
    expect(detectHistorySubject([], 'math')).toBe('math');
  });

  it('detects languages from vocab sheet', () => {
    expect(detectHistorySubject([{ term: 'hello', definition: 'bonjour' }], 'vocab')).toBe('languages');
  });

  it('detects history from content keywords', () => {
    const pairs = [
      { term: 'Empire romain', definition: 'Civilisation antique en Méditerranée' },
      { term: 'Siècle', definition: 'Période de 100 ans' },
    ];
    expect(detectHistorySubject(pairs, 'notes')).toBe('history');
  });

  it('detects physics from explicit physics content', () => {
    const pairs = [
      { term: 'Gravité', definition: 'Force en physique newtonienne' },
      { term: 'Planète', definition: 'Corps céleste en orbite' },
    ];
    expect(detectHistorySubject(pairs, 'notes')).toBe('physics');
  });

  it('detects law instead of physics for droit content', () => {
    const pairs = [
      { term: 'Recettes totales', definition: 'Montant fiscal à déclarer' },
      { term: 'Code civil', definition: 'Ensemble des lois civiles' },
      { term: 'Contrat', definition: 'Accord juridique entre parties' },
    ];
    expect(detectHistorySubject(pairs, 'notes')).toBe('law');
  });

  it('detects law from droit keyword', () => {
    const pairs = [{ term: 'Droit pénal', definition: 'Branche du droit sanctionnant les infractions' }];
    expect(detectHistorySubject(pairs, 'definitions')).toBe('law');
  });
});

describe('buildHistoryTitle', () => {
  it('includes chapter hint when present', () => {
    const pairs = [{ term: 'Chapitre 4', definition: 'Les fractions' }];
    const title = buildHistoryTitle(pairs, 'math', 'notes', 'fr');
    expect(title).toContain('Mathématiques');
    expect(title).toContain('Chapitre 4');
  });

  it('builds vocab word count title', () => {
    const pairs = [
      { term: 'cat', definition: 'chat' },
      { term: 'dog', definition: 'chien' },
    ];
    const title = buildHistoryTitle(pairs, 'languages', 'vocab', 'fr');
    expect(title).toBe('Langues (2 mots)');
  });

  it('labels law deck correctly', () => {
    const pairs = [{ term: 'Recettes totales', definition: 'Total des recettes fiscales' }];
    const title = buildHistoryTitle(pairs, 'law', 'notes', 'fr');
    expect(title).toContain('Droit');
    expect(title).toContain('Recettes totales');
  });
});
