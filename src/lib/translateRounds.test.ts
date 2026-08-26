import { describe, expect, it } from 'vitest';
import { coercePlayablePairs } from './vocabulary';
import {
  buildLocalTranslateRound,
  gradeTranslateAnswer,
  parseAiTranslateRounds,
  tokenizePhrase,
  wrapVocabSentence,
} from './translateRounds';
import type { WordPair } from '../types';

const pair: WordPair = { term: 'auto', definition: 'voiture', termLang: 'nl', defLang: 'fr' };

describe('translateRounds', () => {
  it('puts the scanned word in the source sentence', () => {
    const source = wrapVocabSentence('auto', 'nl');
    expect(source.toLowerCase()).toContain('auto');
    expect(wrapVocabSentence('voiture', 'fr').toLowerCase()).toContain('voiture');
  });

  it('builds tiles that include the target word', () => {
    const round = buildLocalTranslateRound(pair, 0, [pair, { term: 'fiets', definition: 'vélo' }]);
    expect(round).toBeTruthy();
    expect(round!.source.toLowerCase()).toContain('auto');
    expect(round!.expected.join(' ').toLowerCase()).toContain('voiture');
    expect(round!.bank.some((t) => t.text.toLowerCase() === 'voiture')).toBe(true);
  });

  it('treats one wrong tile as a small mistake', () => {
    const expected = tokenizePhrase('Je vois une voiture.');
    expect(gradeTranslateAnswer(['Je', 'vois', 'une', 'vélo'], expected)).toBe('small');
  });

  it('treats a mostly wrong sentence as a big mistake', () => {
    const expected = tokenizePhrase('Je vois une voiture.');
    expect(gradeTranslateAnswer(['bonjour', 'rouge'], expected)).toBe('big');
  });

  it('accepts an exact match', () => {
    const expected = tokenizePhrase('Je vois une voiture.');
    expect(gradeTranslateAnswer(['Je', 'vois', 'une', 'voiture'], expected)).toBe('correct');
  });

  it('parses AI rounds only if both words appear', () => {
    const pairs = coercePlayablePairs([pair]);
    const ok = parseAiTranslateRounds(
      {
        rounds: [
          {
            term: 'auto',
            source: 'Ik zie een auto.',
            target: 'Je vois une voiture.',
            extraTiles: ['vélo'],
          },
        ],
      },
      pairs,
    );
    expect(ok?.[0]?.source).toContain('auto');
    expect(parseAiTranslateRounds({ rounds: [{ term: 'auto', source: 'Hallo', target: 'Salut' }] }, pairs)).toBeNull();
  });
});
