import type { HistoryEntry, SheetType, WordPair } from '../types';
import { isLoggedIn } from './auth';
import { addHistoryEntry } from './history';

const KEY = 'scanplay-pending-guest-deck';

export interface PendingGuestDeck {
  pairs: WordPair[];
  thumbnail?: string;
  sheetType: SheetType;
  savedAt: string;
}

let lastAdopted: HistoryEntry | null = null;

const SHEET_TYPES: SheetType[] = ['vocab', 'notes', 'definitions', 'math'];

function isWordPair(value: unknown): value is WordPair {
  if (!value || typeof value !== 'object') return false;
  const pair = value as WordPair;
  return typeof pair.term === 'string' && typeof pair.definition === 'string';
}

function parseSheetType(value: unknown): SheetType {
  return SHEET_TYPES.includes(value as SheetType) ? (value as SheetType) : 'vocab';
}

function parseDeck(raw: string | null): PendingGuestDeck | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(data.pairs)) return null;
    const pairs = data.pairs.filter(isWordPair);
    if (pairs.length === 0) return null;
    return {
      pairs,
      thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : undefined,
      sheetType: parseSheetType(data.sheetType),
      savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeStore(storage: Storage, payload: string): void {
  try {
    storage.setItem(KEY, payload);
  } catch {
    /* quota / private mode */
  }
}

function readStore(storage: Storage | undefined): PendingGuestDeck | null {
  if (!storage) return null;
  try {
    return parseDeck(storage.getItem(KEY));
  } catch {
    return null;
  }
}

function removeStore(storage: Storage | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Persist the guest-generated deck on-device only.
 * sessionStorage covers the same-tab flow; localStorage covers email-confirm
 * (often a new tab) without putting private pairs in the cloud before auth.
 */
export function savePendingGuestDeck(
  pairs: WordPair[],
  thumbnail?: string,
  sheetType: SheetType = 'vocab',
): void {
  if (isLoggedIn() || pairs.length === 0) return;
  const deck: PendingGuestDeck = {
    pairs,
    thumbnail,
    sheetType,
    savedAt: new Date().toISOString(),
  };
  const full = JSON.stringify(deck);
  try {
    sessionStorage.setItem(KEY, full);
  } catch {
    const withoutThumb = JSON.stringify({ ...deck, thumbnail: undefined });
    writeStore(sessionStorage, withoutThumb);
  }
  try {
    localStorage.setItem(KEY, full);
  } catch {
    const withoutThumb = JSON.stringify({ ...deck, thumbnail: undefined });
    writeStore(localStorage, withoutThumb);
  }
}

export function loadPendingGuestDeck(): PendingGuestDeck | null {
  return readStore(sessionStorage) ?? readStore(localStorage);
}

export function hasPendingGuestDeck(): boolean {
  return loadPendingGuestDeck() != null;
}

export function clearPendingGuestDeck(): void {
  removeStore(sessionStorage);
  removeStore(localStorage);
}

export function peekLastAdoptedGuestDeck(): HistoryEntry | null {
  return lastAdopted;
}

export function takeLastAdoptedGuestDeck(): HistoryEntry | null {
  const entry = lastAdopted;
  lastAdopted = null;
  return entry;
}

/**
 * After cloud pull, attach the pending guest deck to the signed-in account.
 * Safe to call when empty. Does not bypass RLS (history sync uses auth.uid()).
 */
export function adoptPendingGuestDeckIntoHistory(): HistoryEntry | null {
  if (!isLoggedIn()) return null;
  const deck = loadPendingGuestDeck();
  if (!deck) return null;
  try {
    const entry = addHistoryEntry(deck.pairs, deck.thumbnail, undefined, deck.sheetType);
    lastAdopted = entry;
    clearPendingGuestDeck();
    return entry;
  } catch {
    return null;
  }
}
