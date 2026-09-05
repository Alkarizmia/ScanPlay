import type { GameMode, HistoryEntry, SheetType, StepProgressMap, WordPair } from '../types';
import { getPathStepCount } from './planLimits';
import { unpackDeckProgress } from './examEligibility';
import { buildHistoryTitle, detectHistorySubject } from './historySubject';

import { getUserId, isLoggedIn } from './auth';
import { getLocale } from './i18n';
import { getHistoryMax } from './planLimits';



const KEY = 'scanplay-history';
const LAST_HOME_KEY = 'scanplay-last-home-deck';

function lastHomeStorageKey(): string {
  const userId = getUserId();
  return userId ? `${LAST_HOME_KEY}:${userId}` : LAST_HOME_KEY;
}

function rememberLastHomeDeck(entry: { id: string; title: string } | undefined) {
  if (!entry?.id || !entry.title) return;
  try {
    localStorage.setItem(lastHomeStorageKey(), JSON.stringify({ id: entry.id, title: entry.title }));
  } catch {
    /* quota */
  }
}

export function peekLastHomeDeck(): { id: string; title: string } | null {
  try {
    const raw = localStorage.getItem(lastHomeStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; title?: string };
    if (!parsed.id || !parsed.title) return null;
    return { id: parsed.id, title: parsed.title };
  } catch {
    return null;
  }
}

export function getHistory(): HistoryEntry[] {
  const entries = loadHistoryRaw().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (entries[0]) rememberLastHomeDeck(entries[0]);
  return entries;
}

export function loadHistoryRaw(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveHistoryRaw(entries: HistoryEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

function save(entries: HistoryEntry[]): void {
  if (!isLoggedIn()) return;
  saveHistoryRaw(entries);
  void import('./sync').then((m) => m.scheduleSync());
}

function autoTitle(pairs: WordPair[], sheetType?: SheetType): string {
  const locale = getLocale();
  const subject = detectHistorySubject(pairs, sheetType);
  return buildHistoryTitle(pairs, subject, sheetType, locale);
}



export function addHistoryEntry(

  pairs: WordPair[],

  thumbnail?: string,

  lastMode?: GameMode,

  sheetType?: SheetType,

): HistoryEntry {

  const entries = loadHistoryRaw();

  const subject = detectHistorySubject(pairs, sheetType);

  const entry: HistoryEntry = {

    id: crypto.randomUUID(),

    title: autoTitle(pairs, sheetType),

    pairs,

    thumbnail,

    lastMode,

    sheetType,

    subject,

    kind: 'deck',

    pathStepCount: getPathStepCount(),

    createdAt: new Date().toISOString(),

  };

  entries.unshift(entry);

  const max = getHistoryMax();

  save(entries.slice(0, max));

  return entry;

}



export function updateHistoryMode(id: string, mode: GameMode): void {

  const entries = loadHistoryRaw();

  const idx = entries.findIndex((e) => e.id === id);

  if (idx >= 0) {

    entries[idx].lastMode = mode;

    save(entries);

  }

}



export function updateHistoryProgress(id: string, stepProgress: StepProgressMap): void {
  updateHistoryDeckProgress(id, { stepProgress });
}

export function updateHistoryDeckProgress(
  id: string,
  patch: {
    stepProgress?: StepProgressMap;
    examStepProgress?: StepProgressMap;
    examModeLocked?: boolean;
  },
): void {
  const entries = loadHistoryRaw();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) return;

  const entry = entries[idx]!;
  if (patch.stepProgress !== undefined) entry.stepProgress = patch.stepProgress;
  if (patch.examStepProgress !== undefined) entry.examStepProgress = patch.examStepProgress;
  if (patch.examModeLocked !== undefined) entry.examModeLocked = patch.examModeLocked;

  entry.completedSteps = Object.keys(entry.stepProgress ?? {})
    .map(Number)
    .filter((n) => entry.stepProgress?.[n]?.tier === 'gold');

  save(entries);
}

export function readDeckProgress(entry: HistoryEntry | undefined): {
  stepProgress: StepProgressMap;
  examStepProgress: StepProgressMap;
  examModeLocked: boolean;
} {
  if (!entry) {
    return { stepProgress: {}, examStepProgress: {}, examModeLocked: false };
  }
  if (entry.examStepProgress != null || entry.examModeLocked != null) {
    return {
      stepProgress: entry.stepProgress ?? {},
      examStepProgress: entry.examStepProgress ?? {},
      examModeLocked: Boolean(entry.examModeLocked),
    };
  }
  const unpacked = unpackDeckProgress(entry.stepProgress);
  return unpacked;
}



export function deleteHistoryEntry(id: string): void {

  save(loadHistoryRaw().filter((e) => e.id !== id));

  void import('./sync').then((m) => m.syncDeleteDeck(id));

}



export function getHistoryEntry(id: string): HistoryEntry | undefined {

  return loadHistoryRaw().find((e) => e.id === id);

}



export function updateHistorySessionStats(
  id: string,
  scorePct: number,
  xpEarned: number,
): void {
  const entries = loadHistoryRaw();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) return;
  entries[idx].lastScorePct = scorePct;
  entries[idx].lastXpEarned = xpEarned;
  entries[idx].lastPlayedAt = new Date().toISOString();
  entries[idx].playCount = (entries[idx].playCount ?? 0) + 1;
  save(entries);
}

export function touchHistoryPlayed(id: string): void {
  const entries = loadHistoryRaw();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) return;
  entries[idx].lastPlayedAt = new Date().toISOString();
  entries[idx].playCount = (entries[idx].playCount ?? 0) + 1;
  save(entries);
}

export function canAddHistory(): boolean {
  if (!isLoggedIn()) return false;
  return loadHistoryRaw().length < getHistoryMax();
}

