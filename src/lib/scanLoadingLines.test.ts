import { describe, expect, it } from 'vitest';
import { scanTalkLine, scanTalkPhase, scanTalkPools } from './scanLoadingLines';

describe('scanTalkLine', () => {
  it('varies within tips instead of repeating the first line', () => {
    const a = scanTalkLine('fr', 'tips', 0, 0);
    const b = scanTalkLine('fr', 'tips', 0, 1);
    const c = scanTalkLine('fr', 'tips', 4, 0);
    expect(a).toBeTruthy();
    expect(b).not.toBe(a);
    expect(c).not.toBe(a);
  });

  it('keeps tip pools unique and easy to edit (8–10 lines)', () => {
    const pools = scanTalkPools();
    for (const loc of ['fr', 'en', 'nl', 'es', 'ar', 'de'] as const) {
      const tips = pools[loc].tips;
      expect(new Set(tips).size).toBe(tips.length);
      expect(tips.length).toBeGreaterThanOrEqual(8);
      expect(tips.length).toBeLessThanOrEqual(10);
      expect(pools[loc].demo.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('maps generic scan statuses onto tips, and unknown status to passthrough', () => {
    expect(scanTalkPhase('fr', 12, 'Pix lit ta fiche…')).toBe('tips');
    expect(scanTalkPhase('fr', 55, 'Pix déchiffre les indices…')).toBe('tips');
    expect(scanTalkPhase('fr', 95, 'On fabrique tes mini-jeux !')).toBe('tips');
    expect(scanTalkPhase('fr', 20, 'Photo 1/3. Pix y va !')).toBe('passthrough');
  });
});
