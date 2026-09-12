import { afterEach, describe, expect, it, vi } from 'vitest';

const analyzeSheetWithAi = vi.fn();
const extractTextFromImage = vi.fn();

vi.mock('./aiExtract', async () => {
  const actual = await vi.importActual<typeof import('./aiExtract')>('./aiExtract');
  return {
    ...actual,
    isAiScanEnabled: () => true,
    analyzeSheetWithAi,
  };
});

vi.mock('./ocr', () => ({
  extractTextFromImage: (...args: unknown[]) => extractTextFromImage(...args),
}));

vi.mock('./planLimits', async () => {
  const actual = await vi.importActual<typeof import('./planLimits')>('./planLimits');
  return {
    ...actual,
    getMaxWords: () => 25,
  };
});

describe('extractPairsFromImage abort', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not fall back to OCR when aborted', async () => {
    extractTextFromImage.mockImplementation(async () => {
      throw new Error('ocr should not run after abort');
    });
    analyzeSheetWithAi.mockImplementation(
      (_file: File, _type: string, signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );

    const { extractPairsFromImage } = await import('./sheetAnalysis');
    const ac = new AbortController();
    const file = new File(['x'], 'sheet.png', { type: 'image/png' });
    const pending = extractPairsFromImage(file, 'vocab', ac.signal);
    ac.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('runs OCR when AI only returns two vocab cards', async () => {
    analyzeSheetWithAi.mockResolvedValue({
      readable: true,
      sheetType: 'vocab',
      pairs: [
        { term: 'SOMEONE', definition: 'QUELQU\'UN', termLang: 'en', defLang: 'fr', confidence: 'high' },
        { term: 'SOMEBODY', definition: 'QUELQU\'UN', termLang: 'en', defLang: 'fr', confidence: 'high' },
      ],
    });
    extractTextFromImage.mockResolvedValue(`
EVERY = CHAQUE
EVERYTHING = TOUT
EVERYONE = TOUT LE MONDE
EVERYBODY = TOUT LE MONDE
SOMETHING = QUELQUE CHOSE
SOMEONE = QUELQU'UN
SOMEBODY = QUELQU'UN
BEFORE = AVANT
AFTER = APRÈS
NEAR = PRÈS
FAR = LOIN
WITHOUT = SANS
WITH = AVEC
`.trim());

    const { extractPairsFromImage } = await import('./sheetAnalysis');
    const file = new File(['x'], 'sheet.png', { type: 'image/png' });
    const result = await extractPairsFromImage(file, 'vocab');
    expect(extractTextFromImage).toHaveBeenCalled();
    expect(result.pairs.length).toBeGreaterThanOrEqual(8);
    expect(result.source).toBe('ocr');
  });

  it('still runs OCR and merges when AI already returned exactly 8 cards', async () => {
    analyzeSheetWithAi.mockResolvedValue({
      readable: true,
      sheetType: 'vocab',
      pairs: [
        { term: 'EVERY', definition: 'CHAQUE', termLang: 'en', defLang: 'fr', confidence: 'high' },
        { term: 'EVERYTHING', definition: 'TOUT', termLang: 'en', defLang: 'fr', confidence: 'high' },
        { term: 'BEFORE', definition: 'AVANT', termLang: 'en', defLang: 'fr', confidence: 'high' },
        { term: 'AFTER', definition: 'APRÈS', termLang: 'en', defLang: 'fr', confidence: 'high' },
        { term: 'NEAR', definition: 'PRÈS', termLang: 'en', defLang: 'fr', confidence: 'high' },
        { term: 'FAR', definition: 'LOIN', termLang: 'en', defLang: 'fr', confidence: 'high' },
        { term: 'WITHOUT', definition: 'SANS', termLang: 'en', defLang: 'fr', confidence: 'high' },
        { term: 'WITH', definition: 'AVEC', termLang: 'en', defLang: 'fr', confidence: 'high' },
      ],
    });
    extractTextFromImage.mockResolvedValue(`
EVERY = CHAQUE
EVERYTHING = TOUT
EVERYONE = TOUT LE MONDE
EVERYBODY = TOUT LE MONDE
SOMETHING = QUELQUE CHOSE
SOMEONE = QUELQU'UN
SOMEBODY = QUELQU'UN
BEFORE = AVANT
AFTER = APRÈS
NEAR = PRÈS
FAR = LOIN
WITHOUT = SANS
WITH = AVEC
`.trim());

    const { extractPairsFromImage, mergeAiAndOcrPairs } = await import('./sheetAnalysis');
    const file = new File(['x'], 'sheet.png', { type: 'image/png' });
    const result = await extractPairsFromImage(file, 'vocab');
    expect(extractTextFromImage).toHaveBeenCalled();
    expect(result.pairs.length).toBeGreaterThan(8);
    const terms = result.pairs.map((p) => p.term.toUpperCase()).join(' ');
    expect(terms).toMatch(/EVERYONE|EVERYBODY|SOMETHING|SOMEONE|SOMEBODY/);

    const merged = mergeAiAndOcrPairs(
      [
        { term: 'EVERY', definition: 'CHAQUE' },
        { term: 'WITH', definition: 'AVEC' },
      ],
      [
        { term: 'EVERY', definition: 'CHAQUE' },
        { term: 'EVERYONE', definition: 'TOUT LE MONDE' },
        { term: 'SOMETHING', definition: 'QUELQUE CHOSE' },
      ],
      25,
    );
    expect(merged).toHaveLength(4);
    expect(merged.map((p) => p.term)).toEqual(['EVERY', 'WITH', 'EVERYONE', 'SOMETHING']);
  });
});
