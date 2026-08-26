import type { WordPair } from '../types';
import { getQuizPool } from './vocabulary';

export interface TrueFalseRound {
  term: string;
  statement: string;
  isTrue: boolean;
  pairIndex: number;
}

function shuffle<T>(arr: T[], random = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function pickOtherDefinition(current: string, definitions: string[], random: () => number): string | null {
  const alt = definitions.filter((d) => d.toLowerCase() !== current.toLowerCase());
  if (alt.length === 0) return null;
  return alt[Math.floor(random() * alt.length)] ?? null;
}

/** Balanced true/false rounds — never fall back to a true statement when false was planned. */
export function buildTrueFalseRounds(
  pairs: WordPair[],
  options?: { maxRounds?: number; random?: () => number },
): TrueFalseRound[] {
  const random = options?.random ?? Math.random;
  const pool = getQuizPool(pairs);
  const definitions = pool.map((p) => p.definition);
  const distinct = new Set(definitions.map((d) => d.toLowerCase()));
  if (pool.length < 2 || distinct.size < 2) return [];

  const want = Math.min(options?.maxRounds ?? 8, pool.length);
  const shuffled = shuffle(pool, random);
  const nFalse = Math.floor(want / 2);
  const nTrue = want - nFalse;
  const flags = shuffle(
    [...Array.from({ length: nTrue }, () => true), ...Array.from({ length: nFalse }, () => false)],
    random,
  );

  const rounds: TrueFalseRound[] = [];
  for (let i = 0; i < shuffled.length && rounds.length < want; i += 1) {
    const pair = shuffled[i]!;
    const wantTrue = flags[rounds.length] ?? rounds.length % 2 === 0;
    const pairIndex = pool.findIndex((p) => p.term === pair.term && p.definition === pair.definition);
    if (wantTrue) {
      rounds.push({
        term: pair.term,
        statement: pair.definition,
        isTrue: true,
        pairIndex: pairIndex >= 0 ? pairIndex : i,
      });
      continue;
    }
    const other = pickOtherDefinition(pair.definition, definitions, random);
    if (!other) continue;
    rounds.push({
      term: pair.term,
      statement: other,
      isTrue: false,
      pairIndex: pairIndex >= 0 ? pairIndex : i,
    });
  }

  return rounds;
}
