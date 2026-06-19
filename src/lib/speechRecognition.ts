import type { LangCode } from '../types';
import { answersMatch, normalizeTypedAnswer, type AnswerGrade } from './vocabulary';

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechResultChunk = {
  isFinal?: boolean;
  length: number;
  [index: number]: { transcript: string; confidence?: number } | undefined;
};

type SpeechResultEvent = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResultChunk };
};

type SpeechRecognitionCtor = new () => SpeechRec;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const LANG_TAG: Record<LangCode, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  nl: 'nl-NL',
  unknown: 'fr-FR',
};

function resolveRecognitionLang(lang: LangCode | undefined): string {
  return LANG_TAG[lang ?? 'unknown'];
}

const LISTEN_MS = 22000;
const LISTEN_MS_LONG = 30000;

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function hasActiveMicStream(): boolean {
  return Boolean(activeMicStream?.active);
}

export function getActiveMicStream(): MediaStream | null {
  return activeMicStream?.active ? activeMicStream : null;
}

export function isIOSWebSpeech(): boolean {
  return isIOSDevice();
}

let activeMicStream: MediaStream | null = null;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  return window.webkitSpeechRecognition ?? window.SpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() != null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return row[b.length];
}

function isSpokenNearMatch(spoken: string, expected: string): boolean {
  const a = normalizeTypedAnswer(spoken, false);
  const b = normalizeTypedAnswer(expected, false);
  if (!a || !b) return false;
  if (answersMatch(a, b)) return true;
  const maxLen = Math.max(a.length, b.length);
  const minLen = Math.min(a.length, b.length);
  if (maxLen < 2) return false;
  if (minLen < maxLen * 0.55) return false;

  const dist = levenshtein(a, b);
  if (maxLen <= 5 && dist <= 1) return true;
  if (maxLen <= 8 && dist <= 2) return true;
  if (maxLen <= 12 && dist <= 3) return true;
  if (maxLen <= 20 && dist <= 4) return true;
  if (a[0] === b[0] && dist / maxLen <= 0.45) return true;
  return dist / maxLen <= 0.35;
}

/** Near match for a single target word — stricter than generic fuzzy match. */
function isTargetWordNearMatch(spokenWord: string, target: string): boolean {
  if (!isSpokenNearMatch(spokenWord, target)) return false;
  const spoken = normalizeTypedAnswer(spokenWord, false);
  const expected = normalizeTypedAnswer(target, false);
  if (!spoken || !expected) return false;
  if (spoken.length < Math.max(3, Math.floor(expected.length * 0.55))) return false;
  if (spoken[0] !== expected[0] && levenshtein(spoken, expected) > Math.max(2, Math.floor(expected.length * 0.22))) {
    return false;
  }
  return true;
}

function collapseForSpeechMatch(s: string): string {
  return s
    .replace(/[''`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PHRASE_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'at', 'is', 'it', 'this', 'that',
  'de', 'het', 'een', 'en', 'op', 'is', 'in', 'van', 'te', 'dat', 'dit', 'je', 'jij',
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'et', 'ou', 'ce', 'cette', 'dans', 'sur',
  'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'en', 'de', 'que',
  'mot', 'word', 'woord', 'say', 'dire', 'zeg', 'now', 'maintenant', 'nu', 'listen', 'écoute', 'luister',
  'focus', 'concentre', 'herhaal', 'repeat', 'répète', 'hardop', 'aloud', 'voix', 'haute',
]);

function tokenizePhraseWords(text: string): string[] {
  return collapseForSpeechMatch(normalizeTypedAnswer(text, false))
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !PHRASE_STOP_WORDS.has(w));
}

/** Part des mots importants de la phrase reconnus (0–1). */
export function phraseWordMatchRatio(spoken: string, phrase: string): number {
  const expected = tokenizePhraseWords(phrase);
  const heard = tokenizePhraseWords(spoken);
  if (expected.length === 0 || heard.length === 0) return 0;

  let matched = 0;
  for (const word of expected) {
    if (heard.some((h) => answersMatch(h, word) || isSpokenNearMatch(h, word))) matched += 1;
  }
  return matched / expected.length;
}

const PHRASE_PASS_RATIO = 0.5;

function findTargetInSpoken(spoken: string, expected: string): AnswerGrade {
  const normExpected = normalizeTypedAnswer(expected, false);
  if (!normExpected) return 'wrong';

  const spokenWords = collapseForSpeechMatch(normalizeTypedAnswer(spoken, false))
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const expectedWords = normExpected.split(/\s+/).filter(Boolean);

  if (expectedWords.length === 1) {
    const target = expectedWords[0]!;
    let best: AnswerGrade = 'wrong';
    for (const word of spokenWords) {
      if (answersMatch(word, target)) return 'correct';
      if (isTargetWordNearMatch(word, target)) best = 'near';
    }
    return best;
  }

  let best: AnswerGrade = 'wrong';
  for (let i = 0; i <= spokenWords.length - expectedWords.length; i += 1) {
    const slice = spokenWords.slice(i, i + expectedWords.length).join(' ');
    if (answersMatch(slice, normExpected)) return 'correct';
    if (isSpokenNearMatch(slice, normExpected)) best = 'near';
  }
  return best;
}

export interface GradeSpokenOptions {
  /** Full sentence the user may repeat (natural TTS phrase). */
  phraseSpeech?: string;
}

export function gradeSpokenFromCandidates(
  candidates: string[],
  expected: string,
  options?: GradeSpokenOptions,
): AnswerGrade {
  let best: AnswerGrade = 'wrong';
  const pool = new Set<string>();
  for (const raw of candidates) {
    if (raw?.trim()) pool.add(raw.trim());
  }
  if (pool.size > 1) {
    pool.add([...pool].join(' '));
  }

  for (const raw of pool) {
    const targetGrade = findTargetInSpoken(raw, expected);
    if (targetGrade === 'correct') return 'correct';
    if (targetGrade === 'near') {
      if (options?.phraseSpeech && phraseWordMatchRatio(raw, options.phraseSpeech) >= PHRASE_PASS_RATIO) {
        return 'correct';
      }
      best = 'near';
    }
  }
  return best;
}

export function gradeSpokenAnswer(spoken: string, expected: string): AnswerGrade {
  return gradeSpokenFromCandidates([spoken], expected);
}

/** Garde le micro actif avec auto-gain (voix normale, pas besoin de crier). */
export async function acquireMicStream(): Promise<MediaStream | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
  if (activeMicStream?.active) return activeMicStream;

  try {
    activeMicStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });
    await delay(400);
    return activeMicStream;
  } catch {
    return null;
  }
}

export function releaseMicStream(): void {
  activeMicStream?.getTracks().forEach((track) => track.stop());
  activeMicStream = null;
}

/** @deprecated use acquireMicStream */
export async function ensureMicPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  const stream = await acquireMicStream();
  if (stream) return 'granted';
  if (typeof navigator !== 'undefined' && navigator.mediaDevices) return 'denied';
  return 'unsupported';
}

export type SpeechListenError = 'unsupported' | 'denied' | 'error' | 'no-speech' | 'network';

const RETRYABLE: SpeechListenError[] = ['network', 'no-speech', 'error'];

function collectAlternatives(event: SpeechResultEvent): string[] {
  const out = new Set<string>();
  for (let i = 0; i < event.results.length; i += 1) {
    const chunk = event.results[i];
    if (!chunk) continue;
    for (let j = 0; j < chunk.length; j += 1) {
      const text = chunk[j]?.transcript?.trim();
      if (text) out.add(text);
    }
  }
  return [...out];
}

function hasFinalResult(event: SpeechResultEvent): boolean {
  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    if (event.results[i]?.isFinal) return true;
  }
  return false;
}

function listenOnce(
  lang: LangCode | undefined,
  onResult: (alternatives: string[]) => void,
  onError: (reason: SpeechListenError) => void,
  listenMs = LISTEN_MS,
  onInterim?: (transcript: string, alternatives: string[]) => void,
  shouldStopEarly?: (alternatives: string[]) => boolean,
): () => void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    onError('unsupported');
    return () => {};
  }

  const rec = new Ctor();
  rec.lang = resolveRecognitionLang(lang);
  rec.interimResults = true;
  rec.maxAlternatives = 8;
  rec.continuous = true;

  let finished = false;
  let gotResult = false;
  let endTimer: number | undefined;
  let bestInterim: string[] = [];
  let speechStarted = false;

  const startRecognition = () => {
    if (finished || speechStarted) return;
    speechStarted = true;
    try {
      rec.start();
    } catch {
      onError('error');
    }
  };

  const finish = (fn: () => void) => {
    if (finished) return;
    finished = true;
    if (endTimer != null) window.clearTimeout(endTimer);
    fn();
  };

  rec.onresult = (event) => {
    const alts = collectAlternatives(event);
    if (alts.length === 0) return;

    bestInterim = alts;
    onInterim?.(alts[0] ?? '', alts);

    if (shouldStopEarly?.(alts)) {
      gotResult = true;
      finish(() => onResult(alts));
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      return;
    }

    if (hasFinalResult(event)) {
      gotResult = true;
      finish(() => onResult(alts));
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
  };

  rec.onerror = (event) => {
    const code = event.error ?? '';
    if (code === 'aborted' || code === 'interrupted') return;
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      finish(() => onError('denied'));
      return;
    }
    if (code === 'no-speech') {
      if (bestInterim.length > 0) {
        gotResult = true;
        finish(() => onResult(bestInterim));
        return;
      }
      finish(() => onError('no-speech'));
      return;
    }
    if (code === 'network') {
      finish(() => onError('network'));
      return;
    }
    finish(() => onError('error'));
  };

  rec.onend = () => {
    if (finished) return;
    if (bestInterim.length > 0 && !gotResult) {
      gotResult = true;
      finish(() => onResult(bestInterim));
      return;
    }
    endTimer = window.setTimeout(() => {
      if (!finished && !gotResult) finish(() => onError('no-speech'));
    }, isIOSDevice() ? 2200 : 1200);
  };

  if (activeMicStream?.active) {
    startRecognition();
  } else {
    void acquireMicStream().then((stream) => {
      if (finished) return;
      if (!stream) {
        onError('denied');
        return;
      }
      startRecognition();
    });
  }

  const timeout = window.setTimeout(() => {
    if (finished) return;
    if (bestInterim.length > 0) {
      gotResult = true;
      finish(() => onResult(bestInterim));
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  }, listenMs);

  return () => {
    finished = true;
    if (endTimer != null) window.clearTimeout(endTimer);
    window.clearTimeout(timeout);
    try {
      rec.abort();
    } catch {
      /* ignore */
    }
  };
}

/** Écoute avec 2 tentatives (souvent nécessaire sur mobile). */
export function listenForSpeech(
  lang: LangCode | undefined,
  onResult: (transcript: string, alternatives: string[]) => void,
  onError?: (reason: SpeechListenError) => void,
  options?: {
    expectLongPhrase?: boolean;
    onInterim?: (transcript: string, alternatives: string[]) => void;
    shouldStopEarly?: (alternatives: string[]) => boolean;
  },
): () => void {
  let cancelled = false;
  let stopCurrent: (() => void) | null = null;
  const maxAttempts = isIOSDevice() ? 3 : 2;

  const run = async (attempt: number) => {
    if (cancelled) return;
    if (attempt === 0 && !hasActiveMicStream()) await delay(150);

    stopCurrent?.();
    stopCurrent = listenOnce(
      lang,
      (alts) => {
        if (!cancelled) {
          const primary = alts[0] ?? '';
          onResult(primary, alts);
        }
      },
      async (reason) => {
        if (cancelled) return;
        if (attempt < maxAttempts - 1 && RETRYABLE.includes(reason)) {
          await delay(isIOSDevice() ? 900 : 500);
          if (!cancelled) void run(attempt + 1);
          return;
        }
        onError?.(reason);
      },
      options?.expectLongPhrase ? LISTEN_MS_LONG : LISTEN_MS,
      (text, alts) => options?.onInterim?.(text, alts),
      options?.shouldStopEarly,
    );
  };

  void run(0);

  return () => {
    cancelled = true;
    stopCurrent?.();
    stopCurrent = null;
  };
}
