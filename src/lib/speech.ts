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
    case 'de':
      return 'de-DE';
    default:
      return 'fr-FR';
  }
}

const VOICE_HINTS: Record<string, string[]> = {
  'nl-NL': ['Google Nederlands', 'nl-NL', 'Dutch', 'Xander'],
  'fr-FR': ['Google français', 'fr-FR', 'Thomas', 'Amélie', 'French'],
  'en-GB': [
    'Google UK English Female',
    'Google UK English Male',
    'Google UK English',
    'en-GB',
    'Daniel',
    'Microsoft Sonia',
    'Google US English',
    'en-US',
    'Samantha',
    'Microsoft Zira',
  ],
  'es-ES': ['Google español', 'es-ES', 'Spanish', 'Jorge', 'Monica'],
  'de-DE': ['Google Deutsch', 'de-DE', 'German', 'Anna', 'Helena', 'Microsoft Katja'],
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

const FEMALE_VOICE_HINTS = [
  'Female',
  'Samantha',
  'Zira',
  'Sonia',
  'Karen',
  'Moira',
  'Susan',
  'Hazel',
  'Emma',
  'Google UK English Female',
];
const MALE_VOICE_HINTS = [
  'Male',
  'Daniel',
  'David',
  'Mark',
  'Tom',
  'Alex',
  'Fred',
  'Google UK English Male',
  'Microsoft David',
  'Microsoft Mark',
];

function voiceLooksFemale(name: string): boolean {
  const n = name.toLowerCase();
  if (/\bmale\b/.test(n)) return false;
  return FEMALE_VOICE_HINTS.some((h) => n.includes(h.toLowerCase()));
}

function voiceLooksMale(name: string): boolean {
  const n = name.toLowerCase();
  if (/\bfemale\b/.test(n)) return false;
  return MALE_VOICE_HINTS.some((h) => n.includes(h.toLowerCase()));
}

/** Two contrasting English (or lang) voices so dialogue turns are easy to tell apart. */
function pickDialogueVoices(
  langTag: string,
  voices: SpeechSynthesisVoice[],
): [SpeechSynthesisVoice | undefined, SpeechSynthesisVoice | undefined] {
  const prefix = langTag.slice(0, 2);
  const pool = voices.filter(
    (v) => v.lang === langTag || v.lang.startsWith(prefix) || v.lang.startsWith(`${prefix}-`),
  );
  const list = pool.length ? pool : voices;
  const female =
    list.find((v) => voiceLooksFemale(v.name)) ??
    list.find((v) => /female/i.test(v.name));
  const male =
    list.find((v) => voiceLooksMale(v.name) && v !== female) ??
    list.find((v) => /male/i.test(v.name) && v !== female);

  if (female && male) return [female, male];

  // Fallback: two different accents / names when gender labels are missing (common on Android).
  const primary = pickVoice(langTag, voices) ?? list[0];
  const altAccent =
    list.find(
      (v) =>
        v !== primary &&
        primary &&
        v.lang.slice(0, 2) === primary.lang.slice(0, 2) &&
        v.lang !== primary.lang,
    ) ??
    list.find((v) => v !== primary && v.name !== primary?.name) ??
    voices.find((v) => v !== primary && v.lang.startsWith(prefix));
  return [primary, altAccent ?? primary];
}

/** Soft expressiveness from punctuation (browser TTS has no real emotion API). */
function dialogueLineProsody(text: string, speakerIndex: number, baseRate: number): {
  rate: number;
  pitch: number;
} {
  const trimmed = text.trim();
  const isQuestion = /\?\s*$/.test(trimmed);
  const isExclaim = /!\s*$/.test(trimmed);
  const short = trimmed.split(/\s+/).length <= 4;

  // Speaker 0: brighter / a bit quicker. Speaker 1: deeper / steadier.
  let pitch = speakerIndex % 2 === 0 ? 1.14 : 0.86;
  let rate = speakerIndex % 2 === 0 ? baseRate * 1.04 : baseRate * 0.94;

  if (isQuestion) {
    pitch *= speakerIndex % 2 === 0 ? 1.08 : 1.06;
    rate *= 0.96;
  } else if (isExclaim) {
    pitch *= 1.1;
    rate *= 1.06;
  } else if (short) {
    rate *= 0.97;
  }

  return {
    rate: Math.min(1.35, Math.max(0.55, rate)),
    pitch: Math.min(1.45, Math.max(0.65, pitch)),
  };
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

async function speakBrowser(
  spoken: string,
  lang: LangCode | undefined,
  rate?: number,
  pitch = 1,
  voiceOverride?: SpeechSynthesisVoice,
): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const langTag = speechLangTag(lang);
  const voices = await loadVoices();
  const voice = voiceOverride ?? pickVoice(langTag, voices);
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spoken);
  utterance.lang = voice?.lang || langTag;
  if (voice) utterance.voice = voice;
  utterance.rate = Math.min(1.5, Math.max(0.4, rate ?? 0.84));
  utterance.pitch = pitch;
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
    // Some engines never fire onend — don't block the dialogue forever.
    const ms = Math.min(14000, (900 + spoken.length * 85) / Math.max(0.5, rate ?? 0.84));
    window.setTimeout(finish, ms);
  });
}

/** Browser TTS only — no OpenAI / server tokens. Prefer for long dialogues. */
export async function speakLocal(
  text: string,
  lang?: LangCode,
  options?: SpeakOptions & { pitch?: number },
): Promise<void> {
  if (!canSpeak() || !text.trim()) return;
  const spoken = sanitizeTextForSpeech(text);
  if (!spoken) return;
  speakGen += 1;
  stopPlaying();
  await speakBrowser(spoken, lang, options?.rate, options?.pitch ?? 1);
}

export type DialogueSpeakOptions = SpeakOptions & {
  /** 0→1 while lines play (YouTube-style bar). */
  onProgress?: (ratio: number) => void;
};

function estimateUtteranceMs(text: string, rate: number): number {
  const safeRate = Math.min(1.5, Math.max(0.4, rate));
  return Math.min(12000, (650 + text.length * 70) / safeRate);
}

/** Play dialogue lines locally with two distinct voices + light prosody. */
export async function speakDialogueLocal(
  lines: { text: string }[],
  lang: LangCode = 'en',
  options?: DialogueSpeakOptions,
): Promise<void> {
  if (!lines.length) return;
  speakGen += 1;
  const gen = speakGen;
  stopPlaying();
  const baseRate = options?.rate ?? 0.88;
  const spokenLines = lines
    .map((line) => sanitizeTextForSpeech(line.text))
    .filter(Boolean);
  const langTag = speechLangTag(lang);
  const voices = await loadVoices();
  const [voiceA, voiceB] = pickDialogueVoices(langTag, voices);
  const pairGapMs = 320;
  const totalMs =
    spokenLines.reduce((sum, text) => sum + estimateUtteranceMs(text, baseRate) + pairGapMs, 0) ||
    1;
  const startedAt = Date.now();
  let raf = 0;
  const pump = () => {
    if (gen !== speakGen) return;
    const ratio = Math.min(0.98, (Date.now() - startedAt) / totalMs);
    options?.onProgress?.(ratio);
    raf = window.requestAnimationFrame(pump);
  };
  raf = window.requestAnimationFrame(pump);

  try {
    for (let i = 0; i < spokenLines.length; i += 1) {
      if (gen !== speakGen) return;
      const spoken = spokenLines[i]!;
      const speaker = i % 2;
      const { rate, pitch } = dialogueLineProsody(spoken, speaker, baseRate);
      const voice = speaker === 0 ? voiceA : voiceB;
      await speakBrowser(spoken, lang, rate, pitch, voice);
      if (gen !== speakGen) return;
      await new Promise((r) => window.setTimeout(r, pairGapMs));
    }
    options?.onProgress?.(1);
  } finally {
    window.cancelAnimationFrame(raf);
  }
}

/** Stop any in-flight dialogue / TTS (replay / speed change). */
export function stopDialogueSpeech(): void {
  speakGen += 1;
  stopPlaying();
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
