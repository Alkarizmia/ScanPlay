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
});
