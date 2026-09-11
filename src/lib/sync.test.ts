import { describe, expect, it } from 'vitest';
import { hasQueryError } from './sync';

describe('hasQueryError', () => {
  it('treats empty data without error as a successful pull', () => {
    expect(hasQueryError([{ error: null }, { error: undefined }, {}])).toBe(false);
  });

  it('blocks applying defaults when any select failed', () => {
    expect(hasQueryError([{ error: null }, { error: { message: 'network' } }])).toBe(true);
  });
});
