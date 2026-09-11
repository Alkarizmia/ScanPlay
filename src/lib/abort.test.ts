import { describe, expect, it } from 'vitest';
import { isAbortError, throwIfAborted } from './abort';

describe('abort helpers', () => {
  it('detects AbortError', () => {
    expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true);
    expect(isAbortError(new Error('The user aborted a request'))).toBe(true);
    expect(isAbortError(new Error('network'))).toBe(false);
  });

  it('throwIfAborted only when aborted', () => {
    const ac = new AbortController();
    expect(() => throwIfAborted(ac.signal)).not.toThrow();
    ac.abort();
    expect(() => throwIfAborted(ac.signal)).toThrow();
  });
});
