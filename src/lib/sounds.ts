import { getMasterVolumeMultiplier, isMusicEnabled, isSoundEnabled } from './preferences';

export type SoundId =
  | 'appLaunch'
  | 'homeOpen'
  | 'tap'
  | 'cardTap'
  | 'cameraOpen'
  | 'scanStart'
  | 'scanComplete'
  | 'ocrComplete'
  | 'quizStart'
  | 'correct'
  | 'perfect'
  | 'wrong'
  | 'cardFlip'
  | 'matchSnap'
  | 'levelUp'
  | 'xpGain'
  | 'xpCombo'
  | 'achievementUnlock'
  | 'badgeEarned'
  | 'streakDaily'
  | 'streak7'
  | 'streak30'
  | 'notification'
  | 'goalComplete'
  | 'sessionFinish'
  | 'summaryReady'
  | 'shareSuccess'
  | 'profileUpdated'
  | 'premiumUnlock'
  | 'easterEgg'
  | 'miniWin'
  | 'nearMiss'
  | 'nodeStep'
  | 'streakMilestone'
  | 'examTick'
  | 'pop'
  | 'coinPop'
  | 'combo2'
  | 'combo5'
  | 'whoosh'
  | 'reveal'
  | 'sparkle'
  | 'powerUp'
  | 'progressBlip'
  | 'matchPerfect';

export type MusicTheme = 'menu' | 'path' | 'exam';

type Note = {
  f: number;
  d: number;
  t?: OscillatorType;
  v?: number;
  delay?: number;
  harm?: number;
};

type MusicNote = { freq: number; dur: number; gap?: number; vol?: number; harm?: number };

const MENU_MELODY: MusicNote[] = [
  { freq: 523.25, dur: 0.18, gap: 0.1, harm: 261.63 },
  { freq: 659.25, dur: 0.16, gap: 0.08, harm: 329.63 },
  { freq: 783.99, dur: 0.18, gap: 0.1, harm: 392 },
  { freq: 987.77, dur: 0.2, gap: 0.12, harm: 493.88 },
  { freq: 880, dur: 0.16, gap: 0.08, harm: 440 },
  { freq: 783.99, dur: 0.18, gap: 0.1, harm: 392 },
  { freq: 659.25, dur: 0.16, gap: 0.08, harm: 329.63 },
  { freq: 783.99, dur: 0.2, gap: 0.12, harm: 392 },
  { freq: 1046.5, dur: 0.22, gap: 0.14, harm: 523.25 },
  { freq: 880, dur: 0.18, gap: 0.55, harm: 440 },
];

const PATH_MELODY: MusicNote[] = [
  { freq: 330, dur: 0.12, gap: 0.06, harm: 165 },
  { freq: 392, dur: 0.11, gap: 0.05, harm: 196 },
  { freq: 494, dur: 0.13, gap: 0.06, harm: 247 },
  { freq: 587, dur: 0.12, gap: 0.05, harm: 293.66 },
  { freq: 659, dur: 0.14, gap: 0.07, harm: 329.63 },
  { freq: 587, dur: 0.12, gap: 0.05, harm: 293.66 },
  { freq: 494, dur: 0.11, gap: 0.05, harm: 247 },
  { freq: 392, dur: 0.12, gap: 0.06, harm: 196 },
  { freq: 440, dur: 0.13, gap: 0.06, harm: 220 },
  { freq: 523.25, dur: 0.14, gap: 0.07, harm: 261.63 },
  { freq: 659, dur: 0.16, gap: 0.08, harm: 329.63 },
  { freq: 784, dur: 0.18, gap: 0.35, harm: 392 },
];

const EXAM_MELODY: MusicNote[] = [
  { freq: 110, dur: 0.14, gap: 0.08, vol: 0.045 },
  { freq: 146.83, dur: 0.12, gap: 0.06, vol: 0.038 },
  { freq: 110, dur: 0.14, gap: 0.08, vol: 0.045 },
  { freq: 123.47, dur: 0.12, gap: 0.06, vol: 0.04 },
  { freq: 110, dur: 0.14, gap: 0.08, vol: 0.045 },
  { freq: 164.81, dur: 0.13, gap: 0.07, vol: 0.038 },
  { freq: 130.81, dur: 0.14, gap: 0.08, vol: 0.042 },
  { freq: 110, dur: 0.14, gap: 0.08, vol: 0.045 },
  { freq: 146.83, dur: 0.12, gap: 0.06, vol: 0.038 },
  { freq: 110, dur: 0.16, gap: 0.28, vol: 0.045 },
];

type ThemeAudio = {
  melody: MusicNote[];
  osc: OscillatorType;
  harmOsc: OscillatorType;
  masterGain: number;
  filterHz: number;
  noteVol: number;
  harmVol: number;
  attack: number;
};

const THEME_AUDIO: Record<MusicTheme, ThemeAudio> = {
  menu: {
    melody: MENU_MELODY,
    osc: 'triangle',
    harmOsc: 'square',
    masterGain: 0.72,
    filterHz: 2800,
    noteVol: 0.048,
    harmVol: 0.022,
    attack: 0.018,
  },
  path: {
    melody: PATH_MELODY,
    osc: 'sawtooth',
    harmOsc: 'triangle',
    masterGain: 0.68,
    filterHz: 1800,
    noteVol: 0.042,
    harmVol: 0.02,
    attack: 0.012,
  },
  exam: {
    melody: EXAM_MELODY,
    osc: 'square',
    harmOsc: 'sine',
    masterGain: 0.62,
    filterHz: 950,
    noteVol: 0.04,
    harmVol: 0.018,
    attack: 0.01,
  },
};

let ctx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let musicFilter: BiquadFilterNode | null = null;
let musicTimer: number | null = null;
let musicStep = 0;
let activeTheme: MusicTheme | null = null;
let musicSession = 0;
let correctCombo = 0;
let lastCorrectAt = 0;

const DEBOUNCE_MS: Partial<Record<SoundId, number>> = {
  tap: 55,
  cardTap: 70,
  cardFlip: 90,
  examTick: 180,
  progressBlip: 220,
  pop: 45,
  homeOpen: 800,
};

const lastPlayed: Partial<Record<SoundId, number>> = {};

function vol(base: number): number {
  return base * getMasterVolumeMultiplier();
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function canPlay(id: SoundId): boolean {
  const min = DEBOUNCE_MS[id] ?? 0;
  const now = Date.now();
  if (now - (lastPlayed[id] ?? 0) < min) return false;
  lastPlayed[id] = now;
  return true;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.08,
  harmFreq?: number,
): void {
  const audio = getCtx();
  if (!audio) return;
  const t0 = audio.currentTime;

  const playOsc = (f: number, oscType: OscillatorType, gainVal: number) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = oscType;
    osc.frequency.value = f;
    gain.gain.setValueAtTime(vol(gainVal), t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  };

  playOsc(freq, type, volume);
  if (harmFreq && harmFreq > 0) {
    playOsc(harmFreq, 'sine', volume * 0.45);
  }
}

function playNotes(notes: Note[]): void {
  notes.forEach((n) => {
    window.setTimeout(() => {
      tone(n.f, n.d, n.t ?? 'triangle', n.v ?? 0.07, n.harm);
    }, n.delay ?? 0);
  });
}

function playNoiseBurst(duration: number, volume: number, freq = 1400): void {
  const audio = getCtx();
  if (!audio) return;
  const len = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, len, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.4;
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.9;
  const gain = audio.createGain();
  gain.gain.value = vol(volume);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  source.start();
}

function playSweep(from: number, to: number, duration: number, volume: number, type: OscillatorType = 'sine'): void {
  const audio = getCtx();
  if (!audio) return;
  const t0 = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + duration);
  gain.gain.setValueAtTime(vol(volume), t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

const SOUND_MAP: Record<SoundId, () => void> = {
  appLaunch: () => {
    playNotes([
      { f: 392, d: 0.12, v: 0.05, delay: 0 },
      { f: 523.25, d: 0.12, v: 0.055, delay: 80 },
      { f: 659.25, d: 0.14, v: 0.06, delay: 160 },
      { f: 783.99, d: 0.22, v: 0.065, t: 'sine', delay: 260 },
    ]);
  },
  homeOpen: () => {
    tone(880, 0.1, 'sine', 0.04, 440);
  },
  tap: () => tone(587, 0.045, 'triangle', 0.042),
  cardTap: () => tone(440, 0.055, 'triangle', 0.048, 220),
  cameraOpen: () => playSweep(220, 880, 0.18, 0.045, 'sine'),
  scanStart: () => {
    playSweep(330, 660, 0.14, 0.04, 'triangle');
    window.setTimeout(() => tone(880, 0.08, 'sine', 0.035), 120);
  },
  scanComplete: () => {
    playNotes([
      { f: 523.25, d: 0.08, v: 0.055, delay: 0 },
      { f: 659.25, d: 0.1, v: 0.06, delay: 75 },
      { f: 783.99, d: 0.16, v: 0.065, delay: 155 },
    ]);
  },
  ocrComplete: () => {
    playNotes([
      { f: 440, d: 0.07, v: 0.05, t: 'sine', delay: 0 },
      { f: 554.37, d: 0.08, v: 0.052, delay: 65 },
      { f: 659.25, d: 0.09, v: 0.055, delay: 130 },
      { f: 880, d: 0.14, v: 0.05, t: 'sine', harm: 440, delay: 210 },
    ]);
  },
  quizStart: () => {
    playNotes([
      { f: 392, d: 0.07, v: 0.055, delay: 0 },
      { f: 523.25, d: 0.09, v: 0.06, delay: 70 },
      { f: 659.25, d: 0.12, v: 0.065, delay: 150 },
    ]);
  },
  correct: () => {
    playNotes([
      { f: 659.25, d: 0.07, v: 0.065, delay: 0 },
      { f: 880, d: 0.1, v: 0.058, delay: 70 },
      { f: 1046.5, d: 0.12, v: 0.05, t: 'sine', delay: 140 },
    ]);
  },
  perfect: () => {
    playNotes([
      { f: 523.25, d: 0.07, v: 0.06, delay: 0 },
      { f: 659.25, d: 0.07, v: 0.062, delay: 60 },
      { f: 783.99, d: 0.08, v: 0.064, delay: 120 },
      { f: 987.77, d: 0.1, v: 0.066, delay: 180 },
      { f: 1174.66, d: 0.16, v: 0.06, t: 'sine', delay: 260 },
    ]);
  },
  wrong: () => tone(246.94, 0.16, 'triangle', 0.038),
  cardFlip: () => playSweep(520, 780, 0.07, 0.035, 'triangle'),
  matchSnap: () => {
    playNoiseBurst(0.04, 0.028, 1600);
    tone(659.25, 0.08, 'triangle', 0.06, 329.63);
  },
  levelUp: () => {
    playNotes([
      { f: 523.25, d: 0.09, v: 0.065, delay: 0 },
      { f: 659.25, d: 0.09, v: 0.068, delay: 85 },
      { f: 783.99, d: 0.09, v: 0.07, delay: 170 },
      { f: 987.77, d: 0.18, v: 0.072, t: 'sine', delay: 260 },
    ]);
  },
  xpGain: () => {
    playNotes([
      { f: 698.46, d: 0.06, v: 0.052, delay: 0 },
      { f: 880, d: 0.09, v: 0.048, delay: 55 },
    ]);
  },
  xpCombo: () => {
    playNotes([
      { f: 587.33, d: 0.05, v: 0.055, delay: 0 },
      { f: 739.99, d: 0.06, v: 0.058, delay: 45 },
      { f: 880, d: 0.07, v: 0.06, delay: 90 },
      { f: 1046.5, d: 0.1, v: 0.055, delay: 140 },
    ]);
  },
  achievementUnlock: () => {
    playNotes([
      { f: 587.33, d: 0.09, v: 0.065, delay: 0 },
      { f: 739.99, d: 0.09, v: 0.068, delay: 75 },
      { f: 880, d: 0.09, v: 0.07, delay: 150 },
      { f: 1174.66, d: 0.2, v: 0.062, t: 'sine', delay: 235 },
    ]);
  },
  badgeEarned: () => {
    playNotes([
      { f: 659.25, d: 0.08, v: 0.06, delay: 0 },
      { f: 830.61, d: 0.09, v: 0.062, delay: 70 },
      { f: 987.77, d: 0.11, v: 0.064, delay: 140 },
      { f: 1318.51, d: 0.15, v: 0.055, t: 'sine', delay: 220 },
    ]);
  },
  streakDaily: () => {
    playNotes([
      { f: 440, d: 0.08, v: 0.055, delay: 0 },
      { f: 554.37, d: 0.1, v: 0.058, delay: 70 },
    ]);
  },
  streak7: () => {
    playNotes([
      { f: 440, d: 0.08, v: 0.058, delay: 0 },
      { f: 554.37, d: 0.09, v: 0.06, delay: 70 },
      { f: 659.25, d: 0.11, v: 0.062, delay: 150 },
      { f: 880, d: 0.14, v: 0.055, t: 'sine', delay: 230 },
    ]);
  },
  streak30: () => {
    playNotes([
      { f: 392, d: 0.08, v: 0.06, delay: 0 },
      { f: 493.88, d: 0.08, v: 0.062, delay: 65 },
      { f: 587.33, d: 0.09, v: 0.064, delay: 130 },
      { f: 739.99, d: 0.1, v: 0.066, delay: 195 },
      { f: 987.77, d: 0.18, v: 0.06, t: 'sine', delay: 280 },
    ]);
  },
  notification: () => {
    playNotes([
      { f: 783.99, d: 0.07, v: 0.045, t: 'sine', delay: 0 },
      { f: 987.77, d: 0.1, v: 0.042, t: 'sine', delay: 75 },
    ]);
  },
  goalComplete: () => {
    playNotes([
      { f: 523.25, d: 0.08, v: 0.06, delay: 0 },
      { f: 659.25, d: 0.08, v: 0.062, delay: 70 },
      { f: 783.99, d: 0.1, v: 0.064, delay: 140 },
      { f: 1046.5, d: 0.16, v: 0.058, delay: 220 },
    ]);
  },
  sessionFinish: () => {
    playNotes([
      { f: 440, d: 0.09, v: 0.055, delay: 0 },
      { f: 554.37, d: 0.1, v: 0.057, delay: 80 },
      { f: 659.25, d: 0.12, v: 0.055, t: 'sine', delay: 165 },
    ]);
  },
  summaryReady: () => {
    playNotes([
      { f: 523.25, d: 0.07, v: 0.05, t: 'sine', delay: 0 },
      { f: 659.25, d: 0.08, v: 0.052, delay: 65 },
      { f: 783.99, d: 0.09, v: 0.054, delay: 130 },
      { f: 987.77, d: 0.12, v: 0.05, t: 'sine', harm: 493.88, delay: 210 },
    ]);
  },
  shareSuccess: () => {
    playNotes([
      { f: 659.25, d: 0.07, v: 0.05, delay: 0 },
      { f: 880, d: 0.1, v: 0.048, delay: 65 },
    ]);
  },
  profileUpdated: () => tone(698.46, 0.08, 'sine', 0.042, 349.23),
  premiumUnlock: () => {
    playNotes([
      { f: 392, d: 0.08, v: 0.055, t: 'sine', delay: 0 },
      { f: 523.25, d: 0.08, v: 0.057, delay: 70 },
      { f: 659.25, d: 0.09, v: 0.059, delay: 140 },
      { f: 783.99, d: 0.11, v: 0.06, delay: 210 },
      { f: 987.77, d: 0.15, v: 0.055, t: 'sine', delay: 290 },
    ]);
  },
  easterEgg: () => {
    playNotes([
      { f: 523.25, d: 0.06, v: 0.05, delay: 0 },
      { f: 415.3, d: 0.06, v: 0.05, delay: 55 },
      { f: 523.25, d: 0.06, v: 0.05, delay: 110 },
      { f: 622.25, d: 0.08, v: 0.052, delay: 165 },
      { f: 783.99, d: 0.12, v: 0.048, delay: 230 },
    ]);
  },
  miniWin: () => {
    playNotes([
      { f: 523.25, d: 0.05, v: 0.048, delay: 0 },
      { f: 659.25, d: 0.07, v: 0.046, delay: 50 },
    ]);
  },
  nearMiss: () => {
    playNotes([
      { f: 493.88, d: 0.08, v: 0.052, delay: 0 },
      { f: 587.33, d: 0.1, v: 0.048, t: 'sine', delay: 70 },
    ]);
  },
  nodeStep: () => {
    playNotes([
      { f: 440, d: 0.06, v: 0.05, delay: 0 },
      { f: 554.37, d: 0.07, v: 0.048, delay: 60 },
      { f: 659.25, d: 0.09, v: 0.046, delay: 125 },
    ]);
  },
  streakMilestone: () => SOUND_MAP.streak7(),
  examTick: () => tone(330, 0.035, 'square', 0.028),
  pop: () => {
    playNotes([
      { f: 880, d: 0.035, v: 0.055, t: 'sine', delay: 0 },
      { f: 1174.66, d: 0.045, v: 0.048, t: 'sine', delay: 28 },
    ]);
    playNoiseBurst(0.018, 0.012, 2400);
  },
  coinPop: () => {
    playNotes([
      { f: 987.77, d: 0.045, v: 0.062, delay: 0 },
      { f: 1318.51, d: 0.06, v: 0.058, delay: 38 },
      { f: 1567.98, d: 0.09, v: 0.052, t: 'sine', harm: 783.99, delay: 88 },
    ]);
    playNoiseBurst(0.022, 0.018, 2800);
  },
  combo2: () => {
    playNotes([
      { f: 659.25, d: 0.05, v: 0.058, delay: 0 },
      { f: 880, d: 0.07, v: 0.055, delay: 45 },
    ]);
  },
  combo5: () => {
    playNotes([
      { f: 523.25, d: 0.05, v: 0.06, delay: 0 },
      { f: 659.25, d: 0.05, v: 0.062, delay: 42 },
      { f: 783.99, d: 0.06, v: 0.064, delay: 84 },
      { f: 987.77, d: 0.07, v: 0.066, delay: 126 },
      { f: 1174.66, d: 0.12, v: 0.06, t: 'sine', delay: 175 },
    ]);
    playSweep(440, 1320, 0.14, 0.032, 'sine');
  },
  whoosh: () => {
    playSweep(1400, 220, 0.14, 0.038, 'sine');
    playNoiseBurst(0.05, 0.022, 900);
  },
  reveal: () => {
    playSweep(380, 880, 0.1, 0.042, 'triangle');
    playNotes([
      { f: 1046.5, d: 0.08, v: 0.048, t: 'sine', delay: 70 },
    ]);
  },
  sparkle: () => {
    playNotes([
      { f: 1318.51, d: 0.04, v: 0.045, t: 'sine', delay: 0 },
      { f: 1567.98, d: 0.04, v: 0.042, t: 'sine', delay: 35 },
      { f: 1760, d: 0.05, v: 0.04, t: 'sine', delay: 70 },
      { f: 2093, d: 0.07, v: 0.038, t: 'sine', delay: 105 },
    ]);
  },
  powerUp: () => {
    playSweep(220, 880, 0.2, 0.045, 'sawtooth');
    playNotes([
      { f: 523.25, d: 0.08, v: 0.055, delay: 120 },
      { f: 659.25, d: 0.08, v: 0.058, delay: 180 },
      { f: 783.99, d: 0.12, v: 0.06, t: 'sine', delay: 240 },
    ]);
  },
  progressBlip: () => {
    playNotes([
      { f: 698.46, d: 0.04, v: 0.05, delay: 0 },
      { f: 880, d: 0.05, v: 0.046, delay: 35 },
    ]);
  },
  matchPerfect: () => {
    SOUND_MAP.matchSnap();
    window.setTimeout(() => SOUND_MAP.coinPop(), 60);
  },
};

export function playSound(id: SoundId): void {
  if (!isSoundEnabled()) return;
  if (!canPlay(id)) return;
  void getCtx()?.resume();
  SOUND_MAP[id]?.();
  if (id === 'wrong') {
    void import('./mascot/reactions').then((m) => m.mascotReactWrong());
  }
}

export function playStreakSound(streakDays: number): void {
  if (streakDays >= 30) playSound('streak30');
  else if (streakDays >= 7) playSound('streak7');
  else playSound('streakDaily');
}

export function playGameCorrectSound(pathStep: boolean, perfect = false): void {
  const now = Date.now();
  if (now - lastCorrectAt > 2800) correctCombo = 0;
  correctCombo += 1;
  lastCorrectAt = now;

  if (perfect) {
    playSound('perfect');
    window.setTimeout(() => playSound('sparkle'), 80);
  } else if (pathStep) playSound('miniWin');
  else playSound('correct');

  if (correctCombo === 2) playSound('combo2');
  else if (correctCombo >= 5) {
    playSound('combo5');
    window.setTimeout(() => playSound('coinPop'), 100);
  } else if (correctCombo >= 3) playSound('xpCombo');

  let comboLevel = 0;
  if (correctCombo >= 5) comboLevel = 5;
  else if (correctCombo >= 3) comboLevel = 3;
  else if (correctCombo === 2) comboLevel = 2;
  void import('./mascot/reactions').then((m) => m.mascotReactCorrect(comboLevel, perfect));
}

export function resetCorrectCombo(): void {
  correctCombo = 0;
  lastCorrectAt = 0;
}

function playMusicNote(
  freq: number,
  duration: number,
  config: ThemeAudio,
  theme: MusicTheme,
  session: number,
  noteVol?: number,
  harmFreq?: number,
): void {
  if (freq <= 0 || session !== musicSession || !isMusicEnabled()) return;
  const audio = getCtx();
  if (!audio || !musicGain || activeTheme !== theme) return;

  const baseVol = (noteVol ?? config.noteVol) * getMasterVolumeMultiplier();
  const t0 = audio.currentTime;
  const release = duration + 0.06;

  const playOsc = (f: number, type: OscillatorType, gainVal: number) => {
    const osc = audio.createOscillator();
    const noteGain = audio.createGain();
    osc.type = type;
    osc.frequency.value = f;
    noteGain.gain.setValueAtTime(0.001, t0);
    noteGain.gain.linearRampToValueAtTime(gainVal, t0 + config.attack);
    noteGain.gain.exponentialRampToValueAtTime(0.001, t0 + release);
    osc.connect(noteGain);
    noteGain.connect(musicGain!);
    osc.start(t0);
    osc.stop(t0 + release + 0.05);
  };

  playOsc(freq, config.osc, baseVol);
  if (harmFreq && harmFreq > 0 && config.harmVol > 0) {
    playOsc(harmFreq, config.harmOsc, config.harmVol * getMasterVolumeMultiplier());
  }
}

function scheduleMusicTick(theme: MusicTheme, session: number): void {
  if (session !== musicSession || activeTheme !== theme) return;

  const config = THEME_AUDIO[theme];
  const melody = config.melody;
  const note = melody[musicStep % melody.length];
  const delayMs = Math.round(((note.freq > 0 ? note.dur : 0) + (note.gap ?? 0.22)) * 1000);

  musicTimer = window.setTimeout(() => {
    if (session !== musicSession || activeTheme !== theme || !musicGain) return;
    if (!isMusicEnabled()) {
      stopAllMusic();
      return;
    }

    if (note.freq > 0) {
      playMusicNote(note.freq, note.dur, config, theme, session, note.vol, note.harm);
    }
    musicStep += 1;
    scheduleMusicTick(theme, session);
  }, delayMs);
}

function startThemeMusic(theme: MusicTheme): void {
  if (!isMusicEnabled()) {
    stopAllMusic();
    return;
  }
  if (activeTheme === theme && musicTimer !== null) return;

  stopAllMusic();

  const audio = getCtx();
  if (!audio) return;
  void audio.resume();

  const session = musicSession;
  const config = THEME_AUDIO[theme];
  activeTheme = theme;
  musicStep = 0;

  musicGain = audio.createGain();
  const targetGain = config.masterGain * getMasterVolumeMultiplier();
  musicGain.gain.setValueAtTime(0.001, audio.currentTime);
  musicGain.gain.linearRampToValueAtTime(targetGain, audio.currentTime + 0.35);

  musicFilter = audio.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = config.filterHz;
  musicFilter.Q.value = 0.7;
  musicGain.connect(musicFilter);
  musicFilter.connect(audio.destination);

  scheduleMusicTick(theme, session);
}

export function startMenuMusic(): void {
  startThemeMusic('menu');
}

export function startPathMusic(): void {
  startThemeMusic('path');
}

export function startExamMusic(): void {
  startThemeMusic('exam');
}

/** @deprecated use startPathMusic */
export function startGameMusic(): void {
  startPathMusic();
}

export function stopAllMusic(): void {
  musicSession += 1;
  if (musicTimer != null) {
    window.clearTimeout(musicTimer);
    musicTimer = null;
  }
  if (musicGain) {
    try {
      musicGain.disconnect();
    } catch {
      /* already disconnected */
    }
    musicGain = null;
  }
  if (musicFilter) {
    try {
      musicFilter.disconnect();
    } catch {
      /* already disconnected */
    }
    musicFilter = null;
  }
  activeTheme = null;
  musicStep = 0;
}

export function stopGameMusic(): void {
  stopAllMusic();
}

export type BackgroundMusicMode = 'menu' | 'path' | 'exam' | 'off';

export function resolveBackgroundMusicMode(
  flow: string | null,
  examMode = false,
): BackgroundMusicMode {
  if (examMode && (flow === 'modes' || flow === 'playing')) return 'exam';
  if (flow === 'modes' || flow === 'playing') return 'path';
  if (flow === null) return 'menu';
  return 'off';
}

export function ensureBackgroundMusic(mode: BackgroundMusicMode): void {
  if (mode === 'off' || !isMusicEnabled()) {
    stopAllMusic();
    return;
  }
  const audio = getCtx();
  if (audio?.state === 'suspended') void audio.resume();
  if (mode === 'menu') startMenuMusic();
  else if (mode === 'exam') startExamMusic();
  else startPathMusic();
}

export function getActiveMusicTheme(): MusicTheme | null {
  return activeTheme;
}

export function refreshMusicVolume(): void {
  if (!musicGain || !activeTheme) return;
  const audio = getCtx();
  if (!audio) return;
  const config = THEME_AUDIO[activeTheme];
  musicGain.gain.setValueAtTime(config.masterGain * getMasterVolumeMultiplier(), audio.currentTime);
}

/** Preview list for audio settings UI */
export const SOUND_PREVIEW_IDS: { id: SoundId; labelKey: string }[] = [
  { id: 'tap', labelKey: 'audioPreviewTap' },
  { id: 'pop', labelKey: 'audioPreviewPop' },
  { id: 'correct', labelKey: 'audioPreviewCorrect' },
  { id: 'coinPop', labelKey: 'audioPreviewCoin' },
  { id: 'combo2', labelKey: 'audioPreviewCombo' },
  { id: 'combo5', labelKey: 'audioPreviewComboMax' },
  { id: 'perfect', labelKey: 'audioPreviewPerfect' },
  { id: 'sparkle', labelKey: 'audioPreviewSparkle' },
  { id: 'wrong', labelKey: 'audioPreviewWrong' },
  { id: 'reveal', labelKey: 'audioPreviewReveal' },
  { id: 'matchSnap', labelKey: 'audioPreviewMatch' },
  { id: 'levelUp', labelKey: 'audioPreviewLevelUp' },
  { id: 'achievementUnlock', labelKey: 'audioPreviewAchievement' },
  { id: 'whoosh', labelKey: 'audioPreviewWhoosh' },
  { id: 'notification', labelKey: 'audioPreviewNotification' },
];
