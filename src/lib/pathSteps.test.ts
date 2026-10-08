import { describe, expect, it } from 'vitest';
import { pathGameKind } from '../components/icons/PathGameIcons';
import { buildPathSteps } from './pathSteps';
import type { WordPair } from '../types';

const pairs: WordPair[] = [
  { term: 'a', definition: 'b' },
  { term: 'c', definition: 'd' },
  { term: 'e', definition: 'f' },
];

describe('pathGameKind', () => {
  it('maps oral games to listen', () => {
    expect(pathGameKind('listen')).toBe('listen');
    expect(pathGameKind('speak')).toBe('listen');
    expect(pathGameKind('dictation')).toBe('listen');
    expect(pathGameKind('listenpick')).toBe('listen');
  });

  it('maps writing games to write', () => {
    expect(pathGameKind('type')).toBe('write');
    expect(pathGameKind('cloze')).toBe('write');
    expect(pathGameKind('translate')).toBe('write');
    expect(pathGameKind('reorder')).toBe('write');
  });

  it('maps the rest to quiz', () => {
    expect(pathGameKind('quiz')).toBe('quiz');
    expect(pathGameKind('flashcards')).toBe('quiz');
    expect(pathGameKind('match')).toBe('quiz');
    expect(pathGameKind('truefalse')).toBe('quiz');
    expect(pathGameKind('imagepick')).toBe('quiz');
  });
});

describe('buildPathSteps', () => {
  it('builds game-only zigzag nodes (no path chests)', () => {
    const nodes = buildPathSteps(8, pairs, { testChest: true });
    expect(nodes.every((n) => n.kind === 'game')).toBe(true);
    expect(nodes.map((n) => (n.kind === 'game' ? n.id : -1))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(nodes[0]?.x).toBe(26);
    expect(nodes[1]?.x).toBe(74);
    expect(nodes[2]?.x).toBe(26);
  });
});
