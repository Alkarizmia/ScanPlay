import type { LangCode, SheetType, WordPair } from '../types';
import { getPathSheetType } from './pathSheetType';
import { pairHasDistinctLangs, resolveSideLang } from './speakLang';
import { pickVocabToken, splitVocabAlternatives } from './vocabTokens';
import { coercePlayablePairs, isMathLikeText } from './vocabulary';

export interface DictationRound {
  pairIndex: number;
  spoken: string;
  lang: LangCode;
  expected: string;
  accepted: string[];
}

function isSpellable(text: string): boolean {
  return splitVocabAlternatives(text).some((token) => {
    const term = token.trim();
    if (term.length < 2 || term.length > 28) return false;
    if (term.split(/\s+/).length > 3) return false;
    return !isMathLikeText(term);
  });
}

function clipSpoken(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 8) return text.trim();
  return words.slice(0, 8).join(' ');
}

function isDictationPair(pair: WordPair): boolean {
  return pairHasDistinctLangs(pair) && isSpellable(pair.term) && isSpellable(pair.definition);
}

function isKeywordDictationPair(pair: WordPair): boolean {
  return isSpellable(pair.term) && pair.definition.trim().split(/\s+/).length >= 2;
}

export function getDictationPool(pairs: WordPair[]): WordPair[] {
  return coercePlayablePairs(pairs).filter(isDictationPair);
}

export function buildDictationRounds(
  pairs: WordPair[],
  options: { maxRounds?: number; seed?: string; sheetType?: SheetType } = {},
): DictationRound[] {
  const { maxRounds = 4, seed = 'dictation', sheetType = getPathSheetType() } = options;
  if (sheetType === 'math') return [];

  const playable = coercePlayablePairs(pairs);
  const rounds: DictationRound[] = [];

  if (sheetType === 'notes' || sheetType === 'definitions') {
    const pool = playable.filter(isKeywordDictationPair);
    for (let i = 0; i < pool.length && rounds.length < maxRounds; i++) {
      const pair = pool[i]!;
      const spoken = clipSpoken(pair.definition);
      const accepted = splitVocabAlternatives(pair.term);
      if (!spoken || accepted.length === 0) continue;
      rounds.push({
        pairIndex: playable.indexOf(pair),
        spoken,
        lang: resolveSideLang(pair, 'def'),
        expected: accepted[0]!,
        accepted,
      });
    }
    return rounds;
  }

  const pool = playable.filter(isDictationPair);
  for (let i = 0; i < pool.length && rounds.length < maxRounds; i++) {
    const pair = pool[i]!;
    const hearTerm = i % 2 === 0;
    const spokenSide = hearTerm ? pair.term : pair.definition;
    const writeSide = hearTerm ? pair.definition : pair.term;
    const spokenLang = resolveSideLang(pair, hearTerm ? 'term' : 'def');
    const writeLang = resolveSideLang(pair, hearTerm ? 'def' : 'term');
    if (spokenLang !== 'unknown' && writeLang !== 'unknown' && spokenLang === writeLang) {
      continue;
    }

    const spoken = pickVocabToken(spokenSide, `${seed}-spoken-${i}`);
    const accepted = splitVocabAlternatives(writeSide);
    const expected = pickVocabToken(writeSide, `${seed}-write-${i}`);
    if (!spoken || accepted.length === 0) continue;

    rounds.push({
      pairIndex: playable.indexOf(pair),
      spoken,
      lang: spokenLang,
      expected,
      accepted,
    });
  }

  return rounds;
}

export function hasEnoughDictationPairs(pairs: WordPair[]): boolean {
  return buildDictationRounds(pairs, { maxRounds: 2 }).length >= 2;
}
