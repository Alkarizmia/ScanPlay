import type { LangCode } from '../types';
import { getActiveMicStream } from './speechRecognition';

const LANG_WHISPER: Record<LangCode, string> = {
  fr: 'fr',
  en: 'en',
  nl: 'nl',
  unknown: 'fr',
};

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  return '';
}

export function canUseServerTranscribe(): boolean {
  return typeof MediaRecorder !== 'undefined' && pickMimeType().length > 0;
}

export interface VadRecordCallbacks {
  onLevel?: (level: number) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

export interface VadRecordOptions extends VadRecordCallbacks {
  stream?: MediaStream | null;
  /** Silence after speech before sending (ms). */
  silenceMs?: number;
  maxMs?: number;
  minSpeechMs?: number;
  /** Stop if user never speaks within this window (ms). */
  noSpeechMs?: number;
}

export interface VadRecording {
  promise: Promise<Blob | null>;
  stop: () => void;
}

function readMicLevel(analyser: AnalyserNode, timeData: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(timeData);
  let sum = 0;
  for (let i = 0; i < timeData.length; i += 1) {
    const v = (timeData[i]! - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / timeData.length);
}

/**
 * Records until the user pauses (~1 s after speech),
 * then returns audio ready for Groq Whisper.
 */
export function recordSpeechWithVAD(options: VadRecordOptions = {}): VadRecording {
  const silenceMs = options.silenceMs ?? 850;
  const maxMs = options.maxMs ?? 6000;
  const minSpeechMs = options.minSpeechMs ?? 250;
  const noSpeechMs = options.noSpeechMs ?? 4500;
  const mime = pickMimeType();

  if (!mime || typeof window === 'undefined') {
    return { promise: Promise.resolve(null), stop: () => {} };
  }

  let stream = options.stream ?? getActiveMicStream();
  let ownsStream = false;
  let recorder: MediaRecorder | null = null;
  let analyser: AnalyserNode | null = null;
  let audioCtx: AudioContext | null = null;
  let raf = 0;
  let maxTimer = 0;
  let finished = false;
  let speechStarted = false;
  let speechStartAt = 0;
  let lastLoudAt = 0;
  let bootAt = 0;
  const chunks: BlobPart[] = [];

  const SPEAK_THRESHOLD = 0.018;
  const SILENCE_THRESHOLD = 0.012;

  const cleanup = (stopTracks: boolean) => {
    cancelAnimationFrame(raf);
    window.clearTimeout(maxTimer);
    void audioCtx?.close();
    audioCtx = null;
    analyser = null;
    if (stopTracks && ownsStream) {
      stream?.getTracks().forEach((t) => t.stop());
    }
  };

  const finishStop = (resolve: (b: Blob | null) => void) => {
    if (finished) return;
    finished = true;
    options.onSpeechEnd?.();
    cleanup(false);
    if (!recorder || recorder.state === 'inactive') {
      resolve(chunks.length > 0 ? new Blob(chunks, { type: mime }) : null);
      return;
    }
    recorder.onstop = () => {
      resolve(chunks.length > 0 ? new Blob(chunks, { type: mime }) : null);
    };
    try {
      recorder.stop();
    } catch {
      resolve(chunks.length > 0 ? new Blob(chunks, { type: mime }) : null);
    }
  };

  const promise = new Promise<Blob | null>((resolve) => {
    const boot = async () => {
      if (!stream?.active) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true },
          });
          ownsStream = true;
        } catch {
          resolve(null);
          return;
        }
      }

      try {
        audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.45;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        recorder = new MediaRecorder(stream, { mimeType: mime });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.start(100);
        bootAt = Date.now();
      } catch {
        cleanup(ownsStream);
        resolve(null);
        return;
      }

      const timeData = new Uint8Array(analyser!.fftSize);
      const tick = () => {
        if (finished) return;
        const level = readMicLevel(analyser!, timeData);
        options.onLevel?.(Math.min(1, level * 4));

        const now = Date.now();
        if (level >= SPEAK_THRESHOLD) {
          if (!speechStarted) {
            speechStarted = true;
            speechStartAt = now;
            options.onSpeechStart?.();
          }
          lastLoudAt = now;
        } else if (speechStarted && level < SILENCE_THRESHOLD) {
          const spokeMs = now - speechStartAt;
          const quietMs = now - lastLoudAt;
          if (spokeMs >= minSpeechMs && quietMs >= silenceMs) {
            finishStop(resolve);
            return;
          }
        } else if (!speechStarted && bootAt > 0 && now - bootAt >= noSpeechMs) {
          finishStop(resolve);
          return;
        }

        raf = requestAnimationFrame(tick);
      };
      tick();

      maxTimer = window.setTimeout(() => finishStop(resolve), maxMs);
    };

    void boot();
  });

  return {
    promise,
    stop: () => {
      if (finished) return;
      finished = true;
      cleanup(false);
      try {
        if (recorder?.state !== 'inactive') recorder?.stop();
      } catch {
        /* ignore */
      }
    },
  };
}

/** @deprecated utiliser recordSpeechWithVAD */
export async function recordSpeechBlob(maxMs = 7000): Promise<Blob | null> {
  const { promise } = recordSpeechWithVAD({ maxMs, silenceMs: maxMs - 200 });
  return promise;
}

/** Transcription serveur (Groq Whisper si GROQ_API_KEY sur Vercel). */
export async function transcribeViaServer(blob: Blob, lang: LangCode | undefined): Promise<string | null> {
  try {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio: await blobToBase64(blob),
        mime: blob.type,
        lang: LANG_WHISPER[lang ?? 'unknown'],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    return data.text?.trim() || null;
  } catch {
    return null;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
