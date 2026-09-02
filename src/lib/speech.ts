import type { LangCode } from '../types';

function speechLangTag(lang?: LangCode): string {
  switch (lang) {
    case 'nl':
      return 'nl-NL';
    case 'fr':
      return 'fr-FR';
    case 'en':
      return 'en-GB';
    default:
      return 'fr-FR';
  }
}

const VOICE_HINTS: Record<string, string[]> = {
  'nl-NL': ['Google Nederlands', 'nl-NL', 'Dutch', 'Xander'],
  'fr-FR': ['Google français', 'fr-FR', 'Thomas', 'Amélie', 'French'],
  'en-GB': ['Google UK English', 'en-GB', 'Daniel', 'Google US English', 'en-US', 'Samantha', 'Microsoft Zira'],
  'en-US': ['Google US English', 'en-US', 'Samantha', 'Microsoft Zira', 'Karen'],
};

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }
  if (!voicesReady) {
    voicesReady = new Promise((resolve) => {
      const pick = () => {
        const list = window.speechSynthesis.getVoices();
        if (list.length > 0) resolve(list);
      };
      pick();
      window.speechSynthesis.onvoiceschanged = pick;
      window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), 400);
    });
  }
  return voicesReady;
}

function pickVoice(langTag: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const hints = VOICE_HINTS[langTag] ?? [];
  for (const hint of hints) {
    const match = voices.find(
      (v) => v.name.includes(hint) || v.lang === hint || v.lang.startsWith(hint),
    );
    if (match) return match;
  }
  const prefix = langTag.slice(0, 2);
  return (
    voices.find((v) => v.lang === langTag) ??
    voices.find((v) => v.lang.startsWith(prefix) && v.localService) ??
    voices.find((v) => v.lang.startsWith(prefix))
  );
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Retire crochets phonétiques, astérisques et symboles pour une lecture vocale naturelle. */
export function sanitizeTextForSpeech(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\*/g, '')
    .replace(/\b(GB|US|pl\.)\b/gi, ' ')
    .replace(/[«»""„"]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

export interface SpeakOptions {
  /** Speech rate; defaults to a slightly-slower-than-natural 0.84. */
  rate?: number;
}

export async function speakText(
  text: string,
  lang?: LangCode,
  options?: SpeakOptions,
): Promise<void> {
  if (!canSpeak() || !text.trim()) return;

  const spoken = sanitizeTextForSpeech(text);
  if (!spoken) return;

  const langTag = speechLangTag(lang);
  const voices = await loadVoices();
  const voice = pickVoice(langTag, voices);

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spoken);
  utterance.lang = langTag;
  if (voice) utterance.voice = voice;
  utterance.rate = Math.min(1.5, Math.max(0.4, options?.rate ?? 0.84));
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}
