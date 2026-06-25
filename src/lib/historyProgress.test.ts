import { describe, expect, it } from 'vitest';
import { formatHistoryDuration, formatHistoryScore, getHistoryPathProgress } from './historyProgress';
import type { HistoryEntry } from '../types';

describe('formatHistoryScore', () => {
  it('formats as score out of 100', () => {
    expect(formatHistoryScore(50)).toBe('50/100');
    expect(formatHistoryScore(50.4)).toBe('50/100');
    expect(formatHistoryScore(87.6)).toBe('88/100');
  });

  it('clamps invalid values', () => {
    expect(formatHistoryScore(-5)).toBe('0/100');
    expect(formatHistoryScore(120)).toBe('100/100');
  });
});

describe('formatHistoryDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatHistoryDuration(45)).toBe('45 s');
    expect(formatHistoryDuration(90)).toBe('1 min 30 s');
    expect(formatHistoryDuration(120)).toBe('2 min');
    expect(formatHistoryDuration(3661)).toBe('1 h 1 min');
  });

  it('clamps negative values', () => {
    expect(formatHistoryDuration(-10)).toBe('0 s');
  });
});

describe('getHistoryPathProgress', () => {
  it('returns zero for untouched deck', () => {
    const entry: HistoryEntry = {
      id: '1',
      title: 'Test',
      pairs: [{ term: 'a', definition: 'b' }],
      pathStepCount: 10,
      createdAt: new Date().toISOString(),
    };
    const p = getHistoryPathProgress(entry);
    expect(p.fraction).toBe(0);
    expect(p.doneSteps).toBe(0);
    expect(p.totalSteps).toBe(10);
    expect(p.complete).toBe(false);
  });
});
