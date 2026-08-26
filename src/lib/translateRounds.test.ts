import { describe, expect, it } from 'vitest';
import { coercePlayablePairs } from './vocabulary';
import { TRANSLATE_EXERCISE_SYSTEM_PROMPT } from './translateExercisePrompt';
import {
  buildLocalTranslateRound,
  buildLocalTranslateRounds,
  gradeTranslateAnswer,
  looksLikeGlossaryFragment,
  parseAiTranslateRounds,
  tokenizePhrase,
  wrapVocabSentence,
} from './translateRounds';
import type { WordPair } from '../types';

const pair: WordPair = { term: 'auto', definition: 'voiture', termLang: 'nl', defLang: 'fr' };

const glossaryScan: WordPair[] = [
  { term: 'beetje – een beetje', definition: 'un peu', termLang: 'nl', defLang: 'fr' },
  { term: 'water – het water', definition: 'eau', termLang: 'nl', defLang: 'fr' },
];

const vocabListScan: WordPair[] = [
  { term: 'fiets', definition: 'vélo', termLang: 'nl', defLang: 'fr' },
  { term: 'huis', definition: 'maison', termLang: 'nl', defLang: 'fr' },
];

const mixedScan: WordPair[] = [
  { term: 'De kat slaapt.', definition: 'Le chat dort.', termLang: 'nl', defLang: 'fr' },
  { term: 'school', definition: 'école', termLang: 'nl', defLang: 'fr' },
];

const enFrScan: WordPair[] = [
  { term: 'pencil', definition: 'crayon', termLang: 'en', defLang: 'fr' },
  { term: "isn't – is not", definition: "n'est pas", termLang: 'en', defLang: 'fr' },
];

describe('translate exercise prompt', () => {
  it('anchors glossary vs complete sentence in the system prompt', () => {
    expect(TRANSLATE_EXERCISE_SYSTEM_PROMPT).toContain('beetje – een beetje');
    expect(TRANSLATE_EXERCISE_SYSTEM_PROMPT).toContain('Ik zie een beetje water.');
    expect(TRANSLATE_EXERCISE_SYSTEM_PROMPT).toContain('sujet + verbe');
    expect(TRANSLATE_EXERCISE_SYSTEM_PROMPT).toMatch(/Ne recopie JAMAIS/i);
  });
});

describe('translateRounds', () => {
  it('puts the scanned word in the source sentence', () => {
    const source = wrapVocabSentence('auto', 'nl');
    expect(source.toLowerCase()).toContain('auto');
    expect(wrapVocabSentence('voiture', 'fr').toLowerCase()).toContain('voiture');
    expect(wrapVocabSentence('Signe', 'unknown')).toBe('');
    expect(wrapVocabSentence('Signe', 'unknown')).not.toMatch(/Ik zie/i);
  });

  it('does not build a translate round for a French math card', () => {
    const math: WordPair = { term: 'Signe', definition: 'f(x) > 0', termLang: 'fr', defLang: 'fr' };
    expect(buildLocalTranslateRound(math, 0, [math])).toBeNull();
  });

  it('does not paste a glossary fragment as the source sentence', () => {
    const gloss: WordPair = glossaryScan[0]!;
    const round = buildLocalTranslateRound(gloss, 0, [gloss]);
    expect(round).toBeTruthy();
    expect(round!.source).not.toMatch(/–|—/);
    expect(round!.source.toLowerCase()).toContain('beetje');
    expect(round!.source.split(/\s+/).length).toBeGreaterThanOrEqual(3);
    expect(looksLikeGlossaryFragment(round!.source, gloss.term)).toBe(false);
  });

  it('builds complete sentences for 4 typical scan shapes', () => {
    const decks = [glossaryScan, vocabListScan, mixedScan, enFrScan];
    for (const deck of decks) {
      const rounds = buildLocalTranslateRounds(deck, 2);
      expect(rounds.length).toBeGreaterThan(0);
      for (const round of rounds) {
        expect(looksLikeGlossaryFragment(round.source)).toBe(false);
        expect(round.source).not.toMatch(/–|—|=/);
        expect(round.source.split(/\s+/).length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('rejects AI output that recopies a glossary line', () => {
    const parsed = parseAiTranslateRounds(
      {
        rounds: [
          {
            term: 'beetje – een beetje',
            source: 'beetje – een beetje',
            target: 'un peu',
            extraTiles: ['bonjour'],
          },
        ],
      },
      glossaryScan,
    );
    expect(parsed).toBeNull();
  });

  it('accepts AI output that builds a full sentence around the lemma', () => {
    const parsed = parseAiTranslateRounds(
      {
        rounds: [
          {
            term: 'beetje – een beetje',
            source: 'Ik zie een beetje water.',
            target: 'Je vois un peu d eau.',
            extraTiles: ['bonjour'],
          },
        ],
      },
      glossaryScan,
    );
    expect(parsed?.[0]?.source).toBe('Ik zie een beetje water.');
    expect(looksLikeGlossaryFragment(parsed![0]!.source)).toBe(false);
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
