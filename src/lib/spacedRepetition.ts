import type { WordPair } from '../types';
import { hasFeature } from './planLimits';

const KEY = 'scanplay-difficult';

interface DifficultWord {
  term: string;
  definition: string;
  nextReview: string;
  stage: number;
}

function load(): DifficultWord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

function save(words: DifficultWord[]): void {
  localStorage.setItem(KEY, JSON.stringify(words));
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function markDifficult(pair: WordPair): void {
  if (!hasFeature('spaced')) return;
  const words = load();
  const existing = words.find((w) => w.term === pair.term);
  const stages = [1, 3, 7];
  if (existing) {
    existing.stage = Math.min(existing.stage + 1, stages.length - 1);
    existing.nextReview = addDays(stages[existing.stage]);
  } else {
    words.push({
      term: pair.term,
      definition: pair.definition,
      nextReview: addDays(1),
      stage: 0,
    });
  }
  save(words);
}

export function mergeWithDifficult(pairs: WordPair[]): WordPair[] {
  if (!hasFeature('spaced')) return pairs;
  const today = new Date().toISOString().slice(0, 10);
  const due = load().filter((w) => w.nextReview <= today);
  const duePairs = due.map((w) => ({ term: w.term, definition: w.definition }));
  const seen = new Set(pairs.map((p) => p.term));
  const extra = duePairs.filter((p) => !seen.has(p.term));
  return [...extra, ...pairs];
}

export function getDueReviewCount(): number {
  if (!hasFeature('spaced')) return 0;
  const today = new Date().toISOString().slice(0, 10);
  return load().filter((w) => w.nextReview <= today).length;
}

export function exportPairsAsText(pairs: WordPair[]): string {
  return pairs.map((p) => `${p.term} - ${p.definition}`).join('\n');
}

export function exportPairsAsJson(pairs: WordPair[]): string {
  return JSON.stringify(pairs, null, 2);
}
