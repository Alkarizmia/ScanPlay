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

const SILENCE_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
let sharedAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;

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

function ensurePlayer(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.playsInline = true;
    sharedAudio.setAttribute('playsinline', 'true');
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

/** Call from a tap so later neural playback is allowed on mobile. */
export function unlockSpeakAudio(): void {
  const player = ensurePlayer();
  if (!player || audioUnlocked) return;
  player.src = SILENCE_WAV;
  const play = player.play();
  if (play) {
    void play
      .then(() => {
        player.pause();
        audioUnlocked = true;
      })
      .catch(() => {
        /* next tap retries */
      });
  }
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
let objectUrl: string | null = null;

function stopPlaying(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (sharedAudio) {
    sharedAudio.pause();
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
): Promise<Blob | null> {
  const token = await authToken();
  if (!token) return null;
  const payload = { text: clipTtsInput(text), lang: lang ?? 'fr', slow };

  if (isSupabaseConfigured) {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.functions.invoke('tts', { body: payload });
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
): Promise<Blob | null> {
  const key = ttsCacheKey(text, lang, slow ? 0.65 : undefined);
  const cached = audioCache.get(key);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(key);
  if (pending) return pending;

  const request = fetchNeuralBlob(text, lang, slow)
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

export function prefetchSpeak(text: string, lang?: LangCode, options?: SpeakOptions): void {
  if (!neuralTtsEnabled()) return;
  const spoken = sanitizeTextForSpeech(text);
  if (!spoken) return;
  const slow = (options?.rate ?? 0.84) < 0.75;
  void getNeuralBlob(spoken, lang, slow);
}

async function playBlob(blob: Blob, gen: number): Promise<boolean> {
  const player = ensurePlayer();
  if (!player || gen !== speakGen) return false;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(blob);
  player.src = objectUrl;
  try {
    await player.play();
    audioUnlocked = true;
    return true;
  } catch {
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
  stopPlaying();
  const slow = (options?.rate ?? 0.84) < 0.75;
  const neuralOn = neuralTtsEnabled();

  if (neuralOn) {
    try {
      const blob = await Promise.race([
        getNeuralBlob(spoken, lang, slow),
        new Promise<null>((resolve) => {
          window.setTimeout(() => resolve(null), 8000);
        }),
      ]);
      if (gen !== speakGen) return;
      if (blob) {
        await playBlob(blob, gen);
        return;
      }
    } catch {
      if (gen !== speakGen) return;
    }
  }

  if (gen !== speakGen) return;
  await speakBrowser(spoken, lang, options?.rate);
}
