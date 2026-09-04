import { describe, expect, it } from 'vitest';
import { mapAiPairsToWordPairs, parseAiExtractResponse, collectIgnoredAiPairs } from './aiExtract';

describe('aiExtract', () => {
  it('parses valid AI JSON', () => {
    const result = parseAiExtractResponse({
      readable: true,
      sheetType: 'vocab',
      detectedLangs: ['nl', 'fr'],
      pairs: [
        { term: 'hello', definition: 'bonjour', termLang: 'en', defLang: 'fr', confidence: 'high' },
        { term: 'cat', definition: 'chat', termLang: 'en', defLang: 'fr', confidence: 'medium' },
        { term: 'dog', definition: 'chien', termLang: 'en', defLang: 'fr', confidence: 'high' },
        { term: 'book', definition: 'livre', termLang: 'en', defLang: 'fr', confidence: 'high' },
      ],
      warnings: [],
    });

    expect(result?.readable).toBe(true);
    expect(result?.pairs).toHaveLength(4);
    expect(result?.sheetType).toBe('vocab');
  });

  it('maps pairs and truncates length', () => {
    const longTerm = 'a'.repeat(60);
    const mapped = mapAiPairsToWordPairs([
      { term: longTerm, definition: 'ok', termLang: 'fr', defLang: 'fr' },
    ]);
    expect(mapped[0].term).toHaveLength(55);
  });

  it('keeps English article and infinitive vocab instead of treating them as OCR junk', () => {
    const mapped = mapAiPairsToWordPairs([
      { term: 'a baby', definition: 'un bébé', termLang: 'en', defLang: 'fr', confidence: 'high' },
      { term: 'to be born', definition: 'naître', termLang: 'en', defLang: 'fr', confidence: 'medium' },
      { term: 'pregnancy [e]', definition: 'la grossesse', termLang: 'en', defLang: 'fr', confidence: 'high' },
      { term: 'fuif', definition: 'soirée', termLang: 'nl', defLang: 'fr', confidence: 'low' },
    ]);
    expect(mapped.some((p) => p.term === 'a baby')).toBe(true);
    expect(mapped.some((p) => p.term === 'to be born')).toBe(true);
    expect(mapped.some((p) => p.term === 'pregnancy')).toBe(true);
    expect(mapped.find((p) => p.term === 'fuif')?.quality).toBe('uncertain');
  });

  it('keeps related English–French rows that share a French word', () => {
    const mapped = mapAiPairsToWordPairs([
      { term: 'a baby', definition: 'un bébé', termLang: 'en', defLang: 'fr', confidence: 'high' },
      { term: 'a toddler', definition: 'un bébé (qui fait ses premiers pas)', termLang: 'en', defLang: 'fr', confidence: 'high' },
    ]);
    expect(mapped).toHaveLength(2);
  });

  it('drops OCR fragment pairs from AI output', () => {
    const mapped = mapAiPairsToWordPairs([
      { term: 'alles', definition: 'iologiste', termLang: 'nl', defLang: 'fr', confidence: 'medium' },
      { term: 'alles', definition: 'tout', termLang: 'nl', defLang: 'fr', confidence: 'high' },
    ]);
    expect(mapped.some((p) => p.definition === 'iologiste')).toBe(false);
    expect(mapped.some((p) => p.definition === 'tout')).toBe(true);
  });

  it('collects ignored fragment pairs for review internals', () => {
    const ignored = collectIgnoredAiPairs([
      { term: 'alles', definition: 'iologiste', termLang: 'nl', defLang: 'fr', confidence: 'medium' },
      { term: 'alles', definition: 'tout', termLang: 'nl', defLang: 'fr', confidence: 'high' },
    ]);
    expect(ignored.some((p) => p.definition === 'iologiste')).toBe(true);
    expect(ignored.every((p) => p.quality === 'uncertain')).toBe(true);
  });

  it('glosses identical picture-label pairs from vision JSON', () => {
    const mapped = mapAiPairsToWordPairs([
      { term: 'Apple', definition: 'Apple', termLang: 'en', defLang: 'en', confidence: 'high' },
      { term: 'Cat', definition: 'Cat', termLang: 'en', defLang: 'en', confidence: 'high' },
    ]);
    expect(mapped.find((p) => p.term === 'Apple')?.definition.toLowerCase()).toBe('pomme');
    expect(mapped.find((p) => p.term === 'Cat')?.definition.toLowerCase()).toBe('chat');
  });

  it('keeps extraction warnings from vision JSON', () => {
    const result = parseAiExtractResponse({
      readable: true,
      sheetType: 'vocab',
      pairs: [{ term: 'cat', definition: 'chat' }],
      warnings: ['extraction_truncated', 'bas de page flou'],
    });
    expect(result?.warnings).toEqual(['extraction_truncated', 'bas de page flou']);
  });

  it('rejects invalid payload', () => {
    expect(parseAiExtractResponse(null)).toBeNull();
    expect(parseAiExtractResponse({ pairs: [] })).toBeNull();
  });

  it('accepts math sheetType from vision JSON', () => {
    const result = parseAiExtractResponse({
      readable: true,
      sheetType: 'math',
      pairs: [
        { term: 'Domaine', definition: 'D_f = \\mathbb{R} \\setminus \\{1\\}', confidence: 'high' },
      ],
    });
    expect(result?.sheetType).toBe('math');
    expect(result?.pairs[0]?.definition).toContain('\\mathbb{R}');
  });

  it('keeps LaTeX formulas instead of truncating like vocab', () => {
    const latex = 'f(x) = \\frac{x^{2} - 2}{x - 1}';
    const mapped = mapAiPairsToWordPairs(
      [{ term: 'Fonction', definition: latex, confidence: 'high' }],
      { mathSheet: true },
    );
    expect(mapped[0]?.definition).toBe(latex);
  });

  it('does not treat a vocab pair as math', () => {
    const mapped = mapAiPairsToWordPairs([
      { term: 'de zoon', definition: 'le fils', termLang: 'nl', defLang: 'fr', confidence: 'high' },
    ]);
    expect(mapped[0]?.term).toBe('de zoon');
    expect(mapped[0]?.definition).toBe('le fils');
  });

  it('splits opposite rows into one card per word and strips phonetics', () => {
    const mapped = mapAiPairsToWordPairs([
      {
        term: 'riche (adj) / pauvre (adj)',
        definition: 'rijk [rɛjk] / arm [arm]',
        termLang: 'fr',
        defLang: 'nl',
        confidence: 'high',
      },
      {
        term: 'séparément (adv)',
        definition: "apart [a'part]",
        termLang: 'fr',
        defLang: 'nl',
        confidence: 'high',
      },
    ]);
    expect(mapped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ term: 'riche (adj)', definition: 'rijk' }),
        expect.objectContaining({ term: 'pauvre (adj)', definition: 'arm' }),
        expect.objectContaining({ term: 'séparément (adv)', definition: 'apart' }),
      ]),
    );
    expect(mapped).toHaveLength(3);
  });
});
