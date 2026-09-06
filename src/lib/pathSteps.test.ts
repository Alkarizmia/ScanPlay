import { describe, expect, it } from 'vitest';
import { pathGameKind } from '../components/icons/PathGameIcons';
import { buildPathSteps } from './pathSteps';
import { PATH_TEST_CHEST_AFTER_STEP, PATH_TEST_CHEST_ID } from './pathChest';
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

describe('buildPathSteps test chest', () => {
  it('keeps game ids and zigzag when inserting one chest', () => {
    const nodes = buildPathSteps(8, pairs, { testChest: true });
    const games = nodes.filter((n) => n.kind === 'game');
    const chests = nodes.filter((n) => n.kind === 'chest');
    expect(games.map((g) => g.kind === 'game' && g.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(chests).toHaveLength(1);
    expect(chests[0]).toMatchObject({ kind: 'chest', chestId: PATH_TEST_CHEST_ID });
    const chestIndex = nodes.findIndex((n) => n.kind === 'chest');
    expect(chestIndex).toBe(PATH_TEST_CHEST_AFTER_STEP + 1);
    expect(nodes[0]?.x).toBe(26);
    expect(nodes[1]?.x).toBe(74);
    expect(nodes[2]?.x).toBe(26);
  });

  it('does not insert a chest by default', () => {
    const nodes = buildPathSteps(8, pairs);
    expect(nodes.every((n) => n.kind === 'game')).toBe(true);
    expect(nodes).toHaveLength(8);
  });
});
