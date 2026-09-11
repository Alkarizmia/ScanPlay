import type { WordPair } from '../types';

/** Ordered faces for play: term → middle faces → definition. */
export function getCardSides(pair: Pick<WordPair, 'term' | 'definition' | 'faces'>): string[] {
  const middle = (pair.faces ?? [])
    .map((f) => f.trim())
    .filter((f) => f.length >= 1 && f.toLowerCase() !== pair.term.trim().toLowerCase());
  const sides = [pair.term.trim(), ...middle, pair.definition.trim()].filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const side of sides) {
    const key = side.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(side);
  }
  return unique.length >= 2 ? unique : sides.length >= 2 ? sides : [];
}

export function hasMultiFaceCard(pair: Pick<WordPair, 'term' | 'definition' | 'faces'>): boolean {
  return getCardSides(pair).length >= 3;
}

export function normalizeFaces(faces: unknown): string[] | undefined {
  if (!Array.isArray(faces)) return undefined;
  const cleaned = faces
    .filter((f): f is string => typeof f === 'string')
    .map((f) => f.trim())
    .filter((f) => f.length >= 1 && f.length <= 80)
    .slice(0, 6);
  return cleaned.length > 0 ? cleaned : undefined;
}
