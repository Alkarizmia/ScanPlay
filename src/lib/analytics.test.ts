import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ads/consent', () => ({
  hasAdConsent: vi.fn(() => true),
  needsAdConsentPrompt: vi.fn(() => false),
}));

import {
  isLikelyNewAccount,
  isNaturalPartieCompletion,
  readFirstPlayFlags,
  trackCompteCreeOnce,
  trackPremierePartieDemarree,
  trackPremierePartieTerminee,
} from './analytics';

function mockStorage() {
  const store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return store[key] ?? null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      for (const key of Object.keys(store)) delete store[key];
    },
  };
}

describe('analytics helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage());
    const dataLayer: unknown[] = [];
    vi.stubGlobal('dataLayer', dataLayer);
    vi.stubGlobal('gtag', (...args: unknown[]) => {
      dataLayer.push(args);
    });
  });

  it('isLikelyNewAccount respects age window', () => {
    const now = Date.parse('2026-04-01T12:00:00.000Z');
    expect(isLikelyNewAccount(new Date(now - 60_000).toISOString(), now)).toBe(true);
    expect(isLikelyNewAccount(new Date(now - 10 * 60_000).toISOString(), now)).toBe(false);
    expect(isLikelyNewAccount(null, now)).toBe(false);
  });

  it('isNaturalPartieCompletion rejects technical and mid-lesson', () => {
    expect(isNaturalPartieCompletion(undefined)).toBe(true);
    expect(isNaturalPartieCompletion({})).toBe(true);
    expect(isNaturalPartieCompletion({ technical: true })).toBe(false);
    expect(isNaturalPartieCompletion({ lessonContinues: true })).toBe(false);
  });

  it('tracks premiere partie once per scope', () => {
    expect(
      trackPremierePartieDemarree({ userId: 'u1', mode: 'quiz', contexte: 'parcours' }),
    ).toBe(true);
    expect(
      trackPremierePartieDemarree({ userId: 'u1', mode: 'quiz', contexte: 'parcours' }),
    ).toBe(false);
    expect(readFirstPlayFlags('u1')).toEqual({ started: true, completed: false });

    expect(
      trackPremierePartieTerminee({ userId: 'u1', mode: 'quiz', contexte: 'parcours' }),
    ).toBe(true);
    expect(
      trackPremierePartieTerminee({ userId: 'u1', mode: 'match', contexte: 'libre' }),
    ).toBe(false);
    expect(readFirstPlayFlags('u1')).toEqual({ started: true, completed: true });
  });

  it('keeps guest and account first-play scopes separate', () => {
    expect(
      trackPremierePartieDemarree({ userId: null, mode: 'flashcards', contexte: 'libre' }),
    ).toBe(true);
    expect(
      trackPremierePartieDemarree({ userId: 'u2', mode: 'flashcards', contexte: 'libre' }),
    ).toBe(true);
  });

  it('dedupes compte_cree per user id', () => {
    expect(trackCompteCreeOnce('abc', { confirmation: 'direct', methode: 'email' })).toBe(true);
    expect(trackCompteCreeOnce('abc', { confirmation: 'direct', methode: 'google' })).toBe(false);
  });
});
