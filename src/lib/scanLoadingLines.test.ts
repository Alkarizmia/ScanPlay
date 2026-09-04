import { describe, expect, it } from 'vitest';
import { scanTalkLine, scanTalkPhase, scanTalkPools } from './scanLoadingLines';

describe('scanTalkLine', () => {
  it('varies within a phase instead of repeating the first line', () => {
    const a = scanTalkLine('fr', 'decode', 0, 0);
    const b = scanTalkLine('fr', 'decode', 0, 1);
    const c = scanTalkLine('fr', 'decode', 4, 0);
    expect(a).toBeTruthy();
    expect(b).not.toBe(a);
    expect(c).not.toBe(a);
  });

  it('keeps pools unique inside each locale and phase', () => {
    const pools = scanTalkPools();
    for (const loc of ['fr', 'en', 'nl', 'es'] as const) {
      for (const phase of ['read', 'decode', 'build', 'demo'] as const) {
        const lines = pools[loc][phase];
        expect(new Set(lines).size).toBe(lines.length);
        expect(lines.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('maps generic scan statuses onto rotating phases', () => {
    expect(scanTalkPhase('fr', 12, 'Pix lit ta fiche…')).toBe('read');
    expect(scanTalkPhase('fr', 55, 'Pix déchiffre les indices…')).toBe('decode');
    expect(scanTalkPhase('fr', 95, 'On fabrique tes mini-jeux !')).toBe('build');
    expect(scanTalkPhase('fr', 20, 'Photo 1/3. Pix y va !')).toBe('passthrough');
  });
});
