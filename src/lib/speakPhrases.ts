import type { TranslationKey } from './i18n';
import type { LangCode, WordPair } from '../types';
import { resolveSpeakLang } from './speakLang';
import { pickSpeakTarget, speakVariantNote, stripGrammarParentheses } from './speakTerm';
import {
  phraseForSentence,
  tokenizePhrase,
  wrapVocabSentence,
} from './translateRounds';

export const SPEAK_CUE_KEYS = [
  'speakCueRepeat',
  'speakCueYourTurn',
  'speakCueTry',
  'speakCueSayThis',
] as const satisfies readonly TranslationKey[];

export type SpeakCueKey = (typeof SPEAK_CUE_KEYS)[number];

export interface SpeakChallenge {
  context: string;
  phraseDisplay: string;
  phraseSpeech: string;
  target: string;
  lang: LangCode;
  cueKey: SpeakCueKey;
  /** Other forms (not spoken this round). */
  altFormsNote: string | null;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return Math.abs(h);
}

export function pickSpeakCueKey(seed: string): SpeakCueKey {
  return SPEAK_CUE_KEYS[hashSeed(seed) % SPEAK_CUE_KEYS.length]!;
}

function ensureSentencePunctuation(text: string): string {
  const trimmed = text.trim().replace(/[.!?…]+$/u, '');
  if (!trimmed) return text.trim();
  return `${trimmed}.`;
}

function fallbackSentence(term: string, lang: LangCode): string {
  if (lang === 'fr') return `Aujourd'hui on étudie ${term}.`;
  if (lang === 'nl') return `Vandaag leren we ${term}.`;
  return `Today we are learning about ${term}.`;
}

/** Wrap the first occurrence of `focus` so the UI can highlight it inside the sentence. */
export function markFocusInSentence(sentence: string, focus: string): string {
  const f = focus.trim();
  if (!f || !sentence.trim()) return sentence;
  if (sentence.includes(`[${f}]`)) return sentence;

  const tryMark = (needle: string): string | null => {
    if (!needle) return null;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    const match = sentence.match(re);
    if (!match || match.index === undefined) return null;
    return (
      sentence.slice(0, match.index) + `[${match[0]}]` + sentence.slice(match.index + match[0].length)
    );
  };

  return (
    tryMark(f) ??
    tryMark(f.replace(/^(a|an|the|le|la|les|un|une|de|het|een|to)\s+/i, '')) ??
    sentence
  );
}

function alreadyCompleteSentence(text: string): boolean {
  const cleaned = text.trim();
  if (!cleaned) return false;
  if (/[–—]/.test(cleaned) || /\s[-/=]\s/.test(cleaned)) return false;
  return tokenizePhrase(cleaned).length >= 3;
}

export function buildSpeakSentence(rawTerm: string, lang: LangCode): string {
  const cleaned = stripGrammarParentheses(rawTerm);
  if (alreadyCompleteSentence(cleaned)) {
    return ensureSentencePunctuation(cleaned);
  }

  const wrapLang = lang === 'unknown' ? 'en' : lang;
  const wrapped = wrapVocabSentence(cleaned, wrapLang);
  if (wrapped && alreadyCompleteSentence(wrapped) && !/[–—]/.test(wrapped)) {
    return ensureSentencePunctuation(wrapped);
  }

  const lemma = phraseForSentence(cleaned) || cleaned.split(/\s+/)[0] || cleaned;
  return fallbackSentence(lemma, wrapLang);
}

export function buildSpeakChallenge(pair: WordPair): SpeakChallenge {
  const rawTerm = pair.term.trim();
  const target = pickSpeakTarget(rawTerm, pair.definition);
  const lang = resolveSpeakLang(pair);
  const seed = `${target}|${pair.definition}`;
  const phraseSpeech = buildSpeakSentence(rawTerm, lang);
  const focus = phraseForSentence(target) || target;
  const phraseDisplay = markFocusInSentence(phraseSpeech, focus);

  return {
    context: pair.definition.trim(),
    phraseDisplay,
    phraseSpeech,
    target,
    lang,
    cueKey: pickSpeakCueKey(seed),
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
