import type { LangCode, WordPair } from '../types';
import { detectLang } from './columnParser';
import { coercePlayablePairs, isMathLikeText } from './vocabulary';
import { inferColumnLangs } from './pathSheetType';

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

const ARTICLES = new Set([
  'de', 'het', 'een', 'le', 'la', 'les', 'un', 'une', 'the', 'a', 'an', 'el', 'los', 'las',
]);

const EN_ADJECTIVES = new Set([
  'old', 'young', 'new', 'big', 'small', 'little', 'pregnant', 'dead', 'alive', 'happy', 'sad',
  'good', 'bad', 'hot', 'cold', 'long', 'short', 'tall', 'mature', 'stillborn', 'sick', 'healthy',
  'rich', 'poor', 'strong', 'weak', 'fast', 'slow', 'early', 'late', 'open', 'closed',
]);

const FR_ADJECTIVES = new Set([
  'vieux', 'vieille', 'jeune', 'nouveau', 'nouvelle', 'grand', 'grande', 'petit', 'petite',
  'enceinte', 'mort', 'morte', 'vivant', 'vivante', 'heureux', 'heureuse', 'bon', 'bonne',
  'mauvais', 'mauvaise', 'chaud', 'froide', 'froid', 'long', 'longue', 'court', 'courte',
  'mature', 'malade', 'riche', 'pauvre', 'fort', 'forte', 'faible',
]);

const NL_ADJECTIVES = new Set([
  'oud', 'jong', 'nieuw', 'groot', 'klein', 'zwanger', 'dood', 'levend', 'blij', 'verdrietig',
  'goed', 'slecht', 'warm', 'koud', 'lang', 'kort', 'ziek', 'gezond', 'rijk', 'arm',
]);

type VocabKind = 'verb' | 'noun' | 'adj';

function hashPick<T>(seed: string, items: readonly T[]): T {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return items[Math.abs(h) % items.length]!;
}

/** Keep "to be born" / "a baby" instead of collapsing to the longest token. */
export function phraseForSentence(raw: string): string {
  const cleaned = raw.replace(/[–—]/g, '-').trim();
  if (!cleaned) return '';
  const first = cleaned.split(/\s*[-/;,|]\s*/)[0]?.trim() ?? cleaned;
  const clipped = first.replace(/[.,!?]+$/g, '').trim();
  const words = clipped.split(/\s+/).filter(Boolean);
  if (/^to\s+/i.test(clipped) && words.length <= 5) return clipped;
  if (/^(a|an|the|le|la|les|un|une|de|het|een|l['’])\s+/i.test(clipped) && words.length <= 4) {
    return clipped;
  }
  return extractPlayableLemma(raw);
}

function classifyVocab(word: string, lang: LangCode): VocabKind {
  const t = word.trim();
  const low = t.toLowerCase();
  if (/^to\s+/i.test(t)) return 'verb';
  if (lang === 'fr' && /^(l['’]|le |la |les |un |une )/i.test(low) === false && wordsAreInfinitive(t)) {
    return 'verb';
  }
  if (lang === 'nl' && /^te\s+/i.test(t)) return 'verb';
  if (EN_ADJECTIVES.has(low) || FR_ADJECTIVES.has(low) || NL_ADJECTIVES.has(low)) return 'adj';
  if (lang === 'en' && /^(a|an|the)\s+/i.test(t) === false && /(ous|ful|ish|ive|able)$/i.test(low)) {
    return 'adj';
  }
  if (/(ness|tion|sion|ment|esse|té|heid|age)$/i.test(low.replace(/^(le|la|les|un|une|the|a|an|de|het|een)\s+/i, ''))) {
    return 'noun';
  }
  return 'noun';
}

function wordsAreInfinitive(text: string): boolean {
  const w = text.trim();
  if (/\s/.test(w)) return false;
  return /(?:er|ir|re|ître)$/i.test(w) && w.length >= 4;
}

function frNounPhrase(word: string): string {
  if (/^(l['’]|le |la |les |un |une )/i.test(word)) return word;
  const low = word.toLowerCase();
  const fem =
    /(tion|sion|ure|ade|ette|esse|té|nce|ie)$/i.test(low) ||
    (/e$/i.test(low) && !/(age|isme|iste|aire|ège|é)$/i.test(low));
  return fem ? `la ${word}` : `le ${word}`;
}

function enNounPhrase(word: string): string {
  if (/^(a|an|the)\s+/i.test(word)) return word;
  if (/^[aeiou]/i.test(word)) return `an ${word}`;
  return `a ${word}`;
}

function nlNounPhrase(word: string): string {
  if (/^(de|het|een)\s+/i.test(word)) return word;
  return `de ${word}`;
}

/** Prefer a short lemma over a glossary fragment like "beetje – een beetje". */
export function extractPlayableLemma(raw: string): string {
  const cleaned = raw.replace(/[–—]/g, '-').trim();
  if (!cleaned) return '';
  const chunks = cleaned
    .split(/\s*[-/;,|]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const pool = chunks.length > 0 ? chunks : [cleaned];
  for (const chunk of pool) {
    const words = chunk
      .split(/\s+/)
      .map((w) => w.replace(/^[("'[]+|[)"'\]]+$/g, ''))
      .filter((w) => w.length >= 2 && !ARTICLES.has(w.toLowerCase()));
    const pick = [...words].sort((a, b) => b.length - a.length)[0];
    if (pick && pick.length <= 28) return pick;
  }
  return cleaned.split(/\s+/)[0] ?? cleaned;
}

export function wrapVocabSentence(word: string, lang: LangCode): string {
  const w = phraseForSentence(word);
  if (!w) return '';
  const kind = classifyVocab(w, lang);
  const seed = `${lang}:${kind}:${w.toLowerCase()}`;

  if (lang === 'fr') {
    if (kind === 'verb') {
      return hashPick(seed, [`Je veux ${w}.`, `Il faut ${w}.`, `Nous allons ${w}.`]);
    }
    if (kind === 'adj') {
      return hashPick(seed, [`Il est ${w}.`, `Elle est ${w}.`, `C'est trop ${w}.`]);
    }
    const np = frNounPhrase(w);
    return hashPick(seed, [`C'est ${np}.`, `Voici ${np}.`, `J'ai ${np}.`]);
  }

  if (lang === 'nl') {
    if (kind === 'verb') {
      return hashPick(seed, [`Ik wil ${w}.`, `Wij gaan ${w}.`]);
    }
    if (kind === 'adj') {
      return hashPick(seed, [`Hij is ${w}.`, `Het is ${w}.`, `Zij is ${w}.`]);
    }
    const np = nlNounPhrase(w);
    return hashPick(seed, [`Dit is ${np}.`, `Ik heb ${np}.`, `Hier is ${np}.`]);
  }

  if (lang === 'en') {
    if (kind === 'verb') {
      const inf = /^to\s+/i.test(w) ? w : `to ${w}`;
      return hashPick(seed, [`I want ${inf}.`, `They need ${inf}.`, `We try ${inf}.`]);
    }
    if (kind === 'adj') {
      return hashPick(seed, [`It is ${w}.`, `She is ${w}.`, `He looks ${w}.`]);
    }
    const np = enNounPhrase(w);
    return hashPick(seed, [`This is ${np}.`, `I have ${np}.`, `Here is ${np}.`]);
  }

  return '';
}

/** "I see old" / "Je vois vieillesse" — calque, not a real sentence. */
export function isSeeCalqueSentence(text: string, lemma?: string): boolean {
  const t = text.trim().replace(/[.!?]+$/g, '');
  if (/^(see|voir|zien)$/i.test((lemma ?? '').trim())) return false;
  return /^(i see|je vois|ik zie)\s+[^\s]+$/i.test(t);
}

export function looksLikeGlossaryFragment(text: string, rawTerm?: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/[–—]/.test(t) || /\s[-/=]\s/.test(t)) return true;
  if (rawTerm && normalizeToken(t) === normalizeToken(rawTerm)) return true;
  const words = tokenizePhrase(t);
  if (words.length < 3) return true;
  return false;
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
  if (isMathLikeText(pair.term) || isMathLikeText(pair.definition)) return null;

  const term = extractPlayableLemma(pair.term);
  const definition = extractPlayableLemma(pair.definition);
  if (!term || !definition) return null;

  const deckLangs = inferColumnLangs(pool.length > 0 ? pool : [pair]);
  const termLang =
    resolveLang(term, pair.termLang) === 'unknown' ? deckLangs.term : resolveLang(term, pair.termLang);
  const defLang =
    resolveLang(definition, pair.defLang) === 'unknown' ? deckLangs.def : resolveLang(definition, pair.defLang);
  if (termLang === 'unknown' || defLang === 'unknown' || termLang === defLang) return null;

  const source = wrapVocabSentence(pair.term, termLang);
  const target = wrapVocabSentence(pair.definition, defLang);
  if (!source || !target) return null;
  const expected = tokenizePhrase(target);
  if (expected.length === 0) return null;

  const distractors = pool
    .filter((p) => p !== pair)
    .flatMap((p) => tokenizePhrase(extractPlayableLemma(p.definition)))
    .filter((tok) => tok.length > 1 && !/^\d+$/.test(tok));
  const fillers = FILLERS[defLang] ?? [];
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
    const termLemma = extractPlayableLemma(pair.term);
    const defLemma = extractPlayableLemma(pair.definition);
    const sourceOk = source.toLowerCase().includes(termLemma.toLowerCase());
    const targetOk = target.toLowerCase().includes(defLemma.toLowerCase());
    if (!sourceOk || !targetOk) continue;
    if (looksLikeGlossaryFragment(source, pair.term) || looksLikeGlossaryFragment(target, pair.definition)) {
      continue;
    }
    if (isSeeCalqueSentence(source, termLemma) || isSeeCalqueSentence(target, defLemma)) {
      continue;
    }

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
      focusWord: termLemma,
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
