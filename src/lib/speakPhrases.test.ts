import { describe, expect, it } from 'vitest';
import {
  buildSpeakChallenge,
  buildSpeakSentence,
  markFocusInSentence,
  parsePhraseDisplay,
  withAiSpeakSentence,
} from './speakPhrases';
import { tokenizePhrase } from './translateRounds';
import type { WordPair } from '../types';

describe('speak phrases', () => {
  it('builds a complete English sentence around a glossary noun, not a dash template', () => {
    const pair: WordPair = {
      term: 'childbirth',
      definition: "l'accouchement",
      termLang: 'en',
      defLang: 'fr',
    };
    const challenge = buildSpeakChallenge(pair);
    expect(challenge.phraseSpeech.toLowerCase()).toContain('childbirth');
    expect(challenge.phraseSpeech).not.toMatch(/listen, then say it clearly/i);
    expect(challenge.phraseSpeech).not.toMatch(/—/);
    expect(challenge.phraseSpeech.trim()).not.toBe('childbirth');
    expect(tokenizePhrase(challenge.phraseSpeech).length).toBeGreaterThanOrEqual(3);
    expect(challenge.phraseDisplay).toMatch(/\[childbirth\]/i);

    const parts = parsePhraseDisplay(challenge.phraseDisplay);
    const term = parts.find((p) => p.kind === 'term');
    const textAround = parts.filter((p) => p.kind === 'text').map((p) => p.value).join('');
    expect(term?.value.toLowerCase()).toBe('childbirth');
    expect(textAround.replace(/\s/g, '').length).toBeGreaterThan(0);
  });

  it('keeps an already complete scanned sentence', () => {
    const sentence = buildSpeakSentence('The nurse talked about childbirth.', 'en');
    expect(sentence).toMatch(/nurse/i);
    expect(sentence).toMatch(/childbirth/i);
    expect(sentence).not.toMatch(/This is a/i);
  });

  it('highlights the focus word inside the sentence', () => {
    expect(markFocusInSentence('This is a childbirth.', 'childbirth')).toBe(
      'This is a [childbirth].',
    );
  });

  it('does not say Dit is de beetje when speaking a Dutch quantity', () => {
    const sentence = buildSpeakSentence('beetje – een beetje', 'nl');
    expect(sentence.toLowerCase()).toContain('beetje');
    expect(sentence).not.toMatch(/\bde beetje\b/i);
    expect(sentence.toLowerCase()).toMatch(/een beetje/);
  });

  it('does not build Hier is de doen for a Dutch verb', () => {
    const pair: WordPair = { term: 'doen', definition: 'faire', termLang: 'nl', defLang: 'fr' };
    const challenge = buildSpeakChallenge(pair);
    expect(challenge.phraseSpeech).toMatch(/doen/i);
    expect(challenge.phraseSpeech).not.toMatch(/Hier is de doen/i);
    expect(challenge.phraseSpeech).not.toMatch(/Ik heb de doen/i);
    expect(challenge.phraseSpeech).toMatch(/^(Ik wil iets|Wij kunnen iets|Zij moet iets) doen\./i);
  });

  it('makes a French user pronounce Dutch on a FR/NL sheet, even if the pair is flipped', () => {
    const forward: WordPair = { term: 'vinden', definition: 'trouver', termLang: 'nl', defLang: 'fr' };
    const flipped: WordPair = { term: 'trouver', definition: 'vinden', termLang: 'fr', defLang: 'nl' };
    const sleutel: WordPair = { term: 'sleutel', definition: 'clé', termLang: 'nl', defLang: 'fr' };
    const fromTerm = buildSpeakChallenge(forward, 'fr', [forward, sleutel]);
    expect(fromTerm.lang).toBe('nl');
    expect(fromTerm.phraseSpeech.toLowerCase()).toMatch(/vinden/);
    expect(fromTerm.phraseSpeech.toLowerCase()).not.toMatch(/trouver/);
    expect(fromTerm.context.toLowerCase()).toMatch(/trouver/);
    expect(fromTerm.phraseSpeech.toLowerCase()).toMatch(/sleutel/);

    const fromDef = buildSpeakChallenge(flipped, 'fr');
    expect(fromDef.lang).toBe('nl');
    expect(fromDef.phraseSpeech.toLowerCase()).toMatch(/vinden/);
    expect(fromDef.phraseSpeech.toLowerCase()).not.toMatch(/trouver/);
    expect(fromDef.context.toLowerCase()).toMatch(/trouver/);
  });

  it('uses an AI sentence when it still contains the target word', () => {
    const pair: WordPair = {
      term: 'beetje',
      definition: 'un peu',
      termLang: 'nl',
      defLang: 'fr',
    };
    const base = buildSpeakChallenge(pair);
    const next = withAiSpeakSentence(base, 'Er is een beetje water.');
    expect(next.phraseSpeech).toBe('Er is een beetje water.');
    expect(next.phraseDisplay).toMatch(/\[beetje\]/i);
  });
});
