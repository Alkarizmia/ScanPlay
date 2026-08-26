import { describe, expect, it } from 'vitest';
import {
  buildSpeakChallenge,
  buildSpeakSentence,
  markFocusInSentence,
  parsePhraseDisplay,
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
});
