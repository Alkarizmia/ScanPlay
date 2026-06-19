import type { LangCode, WordPair } from '../types';
import { resolveSpeakLang } from './speakLang';
import { pickSpeakTarget, speakVariantNote } from './speakTerm';

type PhraseSlot = 'start' | 'middle' | 'end';

/** Natural sentences — {term} is one clean speakable word. */
const SENTENCE_BANK: Record<LangCode, Record<PhraseSlot, string[]>> = {
  en: {
    start: [
      '{term} is the word I want you to say.',
      '{term} — listen, then say it clearly.',
      '{term} is on my vocabulary sheet.',
    ],
    middle: [
      'Listen carefully: the word is {term}, say it now.',
      'In this exercise, the word is {term}.',
      'Focus on this word: {term}.',
    ],
    end: [
      'Say the word {term} out loud.',
      'Repeat after me: {term}.',
      'Now pronounce the word {term}.',
    ],
  },
  fr: {
    start: [
      'Le mot {term} est celui que tu dois dire.',
      '{term}, c\'est le mot à retenir.',
      'Commence par dire {term}.',
    ],
    middle: [
      'Écoute bien : le mot est {term}, à toi de le prononcer.',
      'Dans cette leçon, le mot est {term}.',
      'Concentre-toi sur le mot {term}.',
    ],
    end: [
      'Répète à voix haute le mot {term}.',
      'Dis maintenant le mot {term}.',
      'Prononce clairement le mot {term}.',
    ],
  },
  nl: {
    start: [
      '{term} is het woord dat je moet zeggen.',
      '{term} staat op mijn woordenlijst.',
      'Begin met het woord {term}.',
    ],
    middle: [
      'Luister goed: het woord is {term}, zeg het nu.',
      'In deze oefening is het woord {term}.',
      'Focus op het woord {term}.',
    ],
    end: [
      'Zeg het woord {term} hardop.',
      'Herhaal na mij: {term}.',
      'Spreek nu het woord {term} uit.',
    ],
  },
  unknown: {
    start: ['{term} is the word to say.'],
    middle: ['The word is {term}, say it.'],
    end: ['Say {term} out loud.'],
  },
};

export interface SpeakChallenge {
  context: string;
  phraseDisplay: string;
  phraseSpeech: string;
  target: string;
  lang: LangCode;
  slot: PhraseSlot;
  /** Other forms (not spoken this round). */
  altFormsNote: string | null;
}

function pickSlot(seed: string): PhraseSlot {
  const n = [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const slots: PhraseSlot[] = ['start', 'middle', 'end'];
  return slots[n % slots.length];
}

function pickTemplate(lang: LangCode, slot: PhraseSlot, seed: string): string {
  const bank = SENTENCE_BANK[lang]?.[slot] ?? SENTENCE_BANK.unknown[slot];
  return bank[seed.length % bank.length];
}

export function buildSpeakChallenge(pair: WordPair): SpeakChallenge {
  const rawTerm = pair.term.trim();
  const target = pickSpeakTarget(rawTerm, pair.definition);
  const lang = resolveSpeakLang(pair);
  const slot = pickSlot(target);
  const template = pickTemplate(lang, slot, target);

  const phraseSpeech = template.replace(/\{term\}/g, target);
  const phraseDisplay = template.replace(/\{term\}/g, `[${target}]`);

  return {
    context: pair.definition.trim(),
    phraseDisplay,
    phraseSpeech,
    target,
    lang,
    slot,
    altFormsNote: speakVariantNote(rawTerm, target),
  };
}

export function parsePhraseDisplay(
  phraseDisplay: string,
): Array<{ kind: 'text' | 'term'; value: string }> {
  const parts = phraseDisplay.split(/(\[[^\]]+\])/g).filter(Boolean);
  return parts.map((part) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      return { kind: 'term' as const, value: part.slice(1, -1) };
    }
    return { kind: 'text' as const, value: part };
  });
}
