import { describe, expect, it } from 'vitest';
import { normalizeCoachSpacing, parseCoachSegments } from './coachMessageFormat';

describe('coachMessageFormat', () => {
  it('splits glued numbered items onto new lines', () => {
    const raw =
      'Pour bien progresser : 1. **Het is jammer** : Revois. 2. **Langues** : Verbes. 3. **Maths** : Bases.';
    const out = normalizeCoachSpacing(raw);
    expect(out).toContain('\n\n1. ');
    expect(out).toContain('\n\n2. ');
    expect(out).toContain('\n\n3. ');
  });

  it('parses **bold** without leaving stars', () => {
    const segments = parseCoachSegments('Revois **Het is jammer** puis **Maths**.');
    expect(segments).toEqual([
      { type: 'text', value: 'Revois ' },
      { type: 'bold', value: 'Het is jammer' },
      { type: 'text', value: ' puis ' },
      { type: 'bold', value: 'Maths' },
      { type: 'text', value: '.' },
    ]);
  });
});
