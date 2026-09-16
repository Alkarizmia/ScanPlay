import type { LangCode } from '../types';
import { clipTtsInput, ttsCacheKey } from './openaiTts';
import { getSupabase, isSupabaseConfigured } from './supabase';

function speechLangTag(lang?: LangCode): string {
  switch (lang) {
    case 'nl':
      return 'nl-NL';
    case 'fr':
      return 'fr-FR';
    case 'en':
      return 'en-GB';
    case 'es':
      return 'es-ES';
    default:
      return 'fr-FR';
  }
}

const VOICE_HINTS: Record<string, string[]> = {
  'nl-NL': ['Google Nederlands', 'nl-NL', 'Dutch', 'Xander'],
  'fr-FR': ['Google français', 'fr-FR', 'Thomas', 'Amélie', 'French'],
  'en-GB': ['Google UK English', 'en-GB', 'Daniel', 'Google US English', 'en-US', 'Samantha', 'Microsoft Zira'],
  'es-ES': ['Google español', 'es-ES', 'Spanish', 'Jorge', 'Monica'],
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
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window || typeof Audio !== 'undefined';
}

function neuralTtsEnabled(): boolean {
  const flag = import.meta.env.VITE_OPENAI_TTS;
  if (flag === '0' || flag === 'false') return false;
  return true;
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

const audioCache = new Map<string, Blob>();
const inflight = new Map<string, Promise<Blob | null>>();
let speakGen = 0;
let currentAudio: HTMLAudioElement | null = null;
let currentAbort: AbortController | null = null;

function stopPlayback(): void {
  currentAbort?.abort();
  currentAbort = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute('src');
    currentAudio.load();
    currentAudio = null;
  }
}

function base64ToBlob(base64: string, mime: string): Blob | null {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    if (bytes.length < 100) return null;
    return new Blob([bytes], { type: mime || 'audio/mpeg' });
  } catch {
    return null;
  }
}

async function authToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  return (await supabase.auth.getSession()).data.session?.access_token ?? null;
}

async function fetchNeuralBlob(
  text: string,
  lang: LangCode | undefined,
  slow: boolean,
  signal: AbortSignal,
): Promise<Blob | null> {
  const token = await authToken();
  if (!token || signal.aborted) return null;
  const payload = { text: clipTtsInput(text), lang: lang ?? 'fr', slow };

  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.functions.invoke('tts', { body: payload });
      if (signal.aborted) return null;
      if (!error && data && typeof data === 'object' && 'audio' in data) {
        const row = data as { audio?: string; mime?: string };
        if (row.audio) return base64ToBlob(row.audio, row.mime ?? 'audio/mpeg');
      }
    }
  }

  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { audio?: string; mime?: string };
  if (!data.audio) return null;
  return base64ToBlob(data.audio, data.mime ?? 'audio/mpeg');
}

function getNeuralBlob(
  text: string,
  lang: LangCode | undefined,
  slow: boolean,
  signal: AbortSignal,
): Promise<Blob | null> {
  const key = ttsCacheKey(text, lang, slow ? 0.65 : undefined);
  const cached = audioCache.get(key);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(key);
  if (pending) return pending;

  const request = fetchNeuralBlob(text, lang, slow, signal)
    .then((blob) => {
      if (blob) audioCache.set(key, blob);
      return blob;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}

async function playBlob(blob: Blob, gen: number): Promise<boolean> {
  if (gen !== speakGen || typeof Audio === 'undefined') return false;
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.preload = 'auto';
  currentAudio = audio;
  try {
    await audio.play();
    audio.addEventListener(
      'ended',
      () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
      },
      { once: true },
    );
    return true;
  } catch {
    URL.revokeObjectURL(url);
    if (currentAudio === audio) currentAudio = null;
    return false;
  }
}

async function speakBrowser(spoken: string, lang: LangCode | undefined, rate?: number): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const langTag = speechLangTag(lang);
  const voices = await loadVoices();
  const voice = pickVoice(langTag, voices);
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spoken);
  utterance.lang = langTag;
  if (voice) utterance.voice = voice;
  utterance.rate = Math.min(1.5, Math.max(0.4, rate ?? 0.84));
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

export async function speakText(
  text: string,
  lang?: LangCode,
  options?: SpeakOptions,
): Promise<void> {
  if (!canSpeak() || !text.trim()) return;

  const spoken = sanitizeTextForSpeech(text);
  if (!spoken) return;

  const gen = ++speakGen;
  stopPlayback();
  const abort = new AbortController();
  currentAbort = abort;
  const slow = (options?.rate ?? 0.84) < 0.75;

  if (neuralTtsEnabled()) {
    try {
      const blob = await Promise.race([
        getNeuralBlob(spoken, lang, slow, abort.signal),
        new Promise<null>((resolve) => {
          window.setTimeout(() => resolve(null), 8000);
        }),
      ]);
      if (gen !== speakGen) return;
      if (blob && (await playBlob(blob, gen))) return;
    } catch {
      if (gen !== speakGen) return;
    }
  }

  if (gen !== speakGen) return;
  await speakBrowser(spoken, lang, options?.rate);
}
