import type { LangCode } from '../types';

export const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
export const MAX_TTS_CHARS = 500;

const LANG_LABEL: Record<Exclude<LangCode, 'unknown'>, string> = {
  fr: 'French (France)',
  nl: 'Dutch (Netherlands)',
  en: 'British English',
  es: 'Spanish (Spain)',
};

export function ttsLang(lang?: LangCode): Exclude<LangCode, 'unknown'> {
  if (lang === 'nl' || lang === 'en' || lang === 'es' || lang === 'fr') return lang;
  return 'fr';
}

export function ttsVoiceForLang(lang?: LangCode): string {
  switch (ttsLang(lang)) {
    case 'nl':
      return 'sage';
    case 'en':
      return 'verse';
    case 'es':
      return 'nova';
    default:
      return 'coral';
  }
}

export function ttsInstructions(lang?: LangCode, rate?: number): string {
  const language = LANG_LABEL[ttsLang(lang)];
  const pace =
    rate != null && rate < 0.75
      ? 'Speak slowly, with a short pause between words.'
      : 'Speak at a calm, natural teaching pace. Not rushed.';
  return `Speak only in ${language}. You are a clear language teacher. Pronounce every word correctly in ${language}. Natural human intonation, not robotic. ${pace} Do not add extra words.`;
}

export function ttsCacheKey(text: string, lang?: LangCode, rate?: number): string {
  const slow = rate != null && rate < 0.75 ? 'slow' : 'n';
  return `${ttsLang(lang)}|${slow}|${text}`;
}

export function clipTtsInput(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_TTS_CHARS) return trimmed;
  return trimmed.slice(0, MAX_TTS_CHARS).trim();
}
