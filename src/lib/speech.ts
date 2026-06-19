import type { LangCode } from '../types';

function speechLangTag(lang?: LangCode): string {
  switch (lang) {
    case 'nl':
      return 'nl-NL';
    case 'fr':
      return 'fr-FR';
    case 'en':
      return 'en-US';
    default:
      return 'fr-FR';
  }
}

const VOICE_HINTS: Record<string, string[]> = {
  'nl-NL': ['Google Nederlands', 'nl-NL', 'Dutch', 'Xander'],
  'fr-FR': ['Google français', 'fr-FR', 'Thomas', 'Amélie', 'French'],
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

/** Retire crochets, guillemets et symboles pour une lecture vocale naturelle. */
export function sanitizeTextForSpeech(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, (m) => m.slice(1, -1))
    .replace(/[«»""„"]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

export async function speakText(text: string, lang?: LangCode): Promise<void> {
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
  utterance.rate = 0.9;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}
