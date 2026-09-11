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
    // OCR supplements thin AI; union is returned (source stays 'ai' unless OCR-only wins by ref)
    expect(result.source).toBe('ai');
  });

  it('returns AI∪OCR union when thin AI and OCR overlap partially', async () => {
    analyzeSheetWithAi.mockResolvedValue({
      readable: true,
      sheetType: 'vocab',
      pairs: [
        { term: 'apple', definition: 'pomme', termLang: 'en', defLang: 'fr', confidence: 'high' },
        { term: 'bread', definition: 'pain', termLang: 'en', defLang: 'fr', confidence: 'high' },
        { term: 'cheese', definition: 'fromage', termLang: 'en', defLang: 'fr', confidence: 'high' },
        { term: 'door', definition: 'porte', termLang: 'en', defLang: 'fr', confidence: 'high' },
        { term: 'egg', definition: 'oeuf', termLang: 'en', defLang: 'fr', confidence: 'high' },
      ],
    });
    // 3 overlap (apple, bread, cheese) + 5 OCR-only; AI-only door/egg must survive the merge
    extractTextFromImage.mockResolvedValue(`
apple = pomme
bread = pain
cheese = fromage
fish = poisson
grape = raisin
house = maison
ink = encre
juice = jus
`.trim());

    const { extractPairsFromImage } = await import('./sheetAnalysis');
    const file = new File(['x'], 'sheet.png', { type: 'image/png' });
    const result = await extractPairsFromImage(file, 'vocab');
    expect(extractTextFromImage).toHaveBeenCalled();
    // Buggy path returned OCR-only (~8); union must keep AI-only + OCR-only cards
    expect(result.pairs.length).toBeGreaterThan(8);
    expect(result.source).toBe('ai');
    const keys = new Set(result.pairs.map((p) => `${p.term.toLowerCase()}\t${p.definition.toLowerCase()}`));
    expect(keys.has('door\tporte')).toBe(true);
    expect(keys.has('egg\toeuf')).toBe(true);
    expect(keys.has('juice\tjus')).toBe(true);
    expect(keys.has('fish\tpoisson')).toBe(true);
  });
});
