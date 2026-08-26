import type { LangCode, WordPair } from '../types';
import { detectLang } from './columnParser';
import { coercePlayablePairs } from './vocabulary';

export type TranslateGrade = 'correct' | 'small' | 'big';

export interface TranslateTile {
  id: string;
  text: string;
}

export interface TranslateRound {
  pairIndex: number;
  source: string;
  focusWord: string;
  expected: string[];
  bank: TranslateTile[];
  termLang: LangCode;
}

const FILLERS: Record<string, string[]> = {
  fr: ['je m\'appelle', 'bonjour', 'rouge', 'petit', 'toujours'],
  nl: ['ik heet', 'hallo', 'rood', 'klein', 'altijd'],
  en: ['my name is', 'hello', 'red', 'small', 'always'],
  es: ['me llamo', 'hola', 'rojo', 'pequeño', 'siempre'],
};

function resolveLang(text: string, hint?: LangCode): LangCode {
  if (hint && hint !== 'unknown') return hint;
  return detectLang(text);
}

export function wrapVocabSentence(word: string, lang: LangCode): string {
  const w = word.trim();
  if (!w) return '';
  switch (lang) {
    case 'fr':
      return `Je vois ${w}.`;
    case 'nl':
      return `Ik zie ${w}.`;
    case 'en':
      return `I see ${w}.`;
    default:
      return `${w}.`;
  }
}

export function tokenizePhrase(phrase: string): string[] {
  return phrase
    .replace(/[«»""]/g, '')
    .split(/\s+/)
    .map((tok) => tok.replace(/^[.,!?;:]+|[.,!?;:]+$/g, '').trim())
    .filter(Boolean);
}

export function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/’/g, "'")
    .replace(/[^a-z0-9'\-]/gi, '');
}

function tokenLevenshtein(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[m]![n]!;
}

function isAdjacentSwap(a: string[], b: string[]): boolean {
  if (a.length !== b.length || a.length < 2) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (i >= a.length - 1) return false;
  if (a[i] === b[i + 1] && a[i + 1] === b[i]) {
    const restEqual = a.slice(i + 2).every((t, k) => t === b[i + 2 + k]);
    return restEqual;
  }
  return false;
}

export function gradeTranslateAnswer(assembled: string[], expected: string[]): TranslateGrade {
  const got = assembled.map(normalizeToken).filter(Boolean);
  const want = expected.map(normalizeToken).filter(Boolean);
  if (want.length === 0) return 'big';
  if (got.length === 0) return 'big';
  if (got.join(' ') === want.join(' ')) return 'correct';
  if (got.length < Math.ceil(want.length * 0.5)) return 'big';
  if (isAdjacentSwap(got, want)) return 'small';
  const dist = tokenLevenshtein(got, want);
  if (dist <= 1) return 'small';
  return 'big';
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function makeTiles(tokens: string[], prefix: string, unique = false): TranslateTile[] {
  const seen = new Set<string>();
  const tiles: TranslateTile[] = [];
  for (const raw of tokens) {
    const text = raw.trim();
    if (!text) continue;
    const key = normalizeToken(text);
    if (!key) continue;
    if (unique && seen.has(key)) continue;
    seen.add(key);
    tiles.push({ id: `${prefix}-${tiles.length}-${key}`, text });
  }
  return tiles;
}

export function buildLocalTranslateRound(
  pair: WordPair,
  pairIndex: number,
  pool: WordPair[],
): TranslateRound | null {
  const term = pair.term.trim();
  const definition = pair.definition.trim();
  if (!term || !definition) return null;

  const termLang = resolveLang(term, pair.termLang);
  const defLang = resolveLang(definition, pair.defLang);
  const source = wrapVocabSentence(term, termLang);
  const target = wrapVocabSentence(definition, defLang);
  const expected = tokenizePhrase(target);
  if (expected.length === 0) return null;

  const distractors = pool
    .filter((p) => p !== pair)
    .flatMap((p) => tokenizePhrase(p.definition))
    .slice(0, 6);
  const fillers = FILLERS[defLang] ?? FILLERS.fr ?? [];
  const answerTiles = makeTiles(expected, `a${pairIndex}`);
  const extraTiles = makeTiles([...distractors, ...fillers], `x${pairIndex}`, true).filter(
    (tile) => !answerTiles.some((a) => normalizeToken(a.text) === normalizeToken(tile.text)),
  );
  const bank = shuffle([...answerTiles, ...extraTiles]).slice(0, Math.max(expected.length + 3, 8));
  for (const tile of answerTiles) {
    if (!bank.some((b) => b.id === tile.id)) bank.push(tile);
  }

  return {
    pairIndex,
    source,
    focusWord: term,
    expected,
    bank: shuffle(bank),
    termLang,
  };
}

export function buildLocalTranslateRounds(pairs: WordPair[], maxRounds: number): TranslateRound[] {
  const pool = coercePlayablePairs(pairs);
  const rounds: TranslateRound[] = [];
  for (let i = 0; i < pool.length && rounds.length < maxRounds; i++) {
    const round = buildLocalTranslateRound(pool[i]!, i, pool);
    if (round) rounds.push(round);
  }
  return rounds;
}

export function parseAiTranslateRounds(
  raw: unknown,
  pairs: WordPair[],
): TranslateRound[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as { rounds?: unknown };
  if (!Array.isArray(data.rounds)) return null;
  const pool = coercePlayablePairs(pairs);
  const out: TranslateRound[] = [];

  for (const item of data.rounds) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const term = String(row.term ?? '').trim();
    const source = String(row.source ?? '').trim();
    const target = String(row.target ?? '').trim();
    if (!term || !source || !target) continue;
    const pairIndex = pool.findIndex(
      (p) => p.term.trim().toLowerCase() === term.toLowerCase(),
    );
    const pair = pairIndex >= 0 ? pool[pairIndex]! : null;
    if (!pair) continue;
    if (!source.toLowerCase().includes(pair.term.trim().toLowerCase())) continue;
    if (!target.toLowerCase().includes(pair.definition.trim().toLowerCase())) continue;

    const expected = tokenizePhrase(target);
    if (expected.length < 2) continue;
    const extra = Array.isArray(row.extraTiles) ? row.extraTiles.map(String) : [];
    const bank = shuffle([
      ...makeTiles(expected, `ai${pairIndex}`),
      ...makeTiles(extra, `ax${pairIndex}`, true),
    ]);
    out.push({
      pairIndex,
      source,
      focusWord: pair.term.trim(),
      expected,
      bank,
      termLang: resolveLang(pair.term, pair.termLang),
    });
  }

  return out.length > 0 ? out : null;
}

export function highlightFocusParts(source: string, focusWord: string): { text: string; hit: boolean }[] {
  const word = focusWord.trim();
  if (!word) return [{ text: source, hit: false }];
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'i');
  const parts = source.split(re);
  return parts.filter(Boolean).map((text) => ({
    text,
    hit: text.toLowerCase() === word.toLowerCase(),
  }));
}
