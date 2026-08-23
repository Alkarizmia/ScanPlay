import { describe, expect, it } from 'vitest';
import { mapAiPairsToWordPairs, parseAiExtractResponse } from './aiExtract';

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

  it('drops low-confidence and fragment pairs from AI output', () => {
    const mapped = mapAiPairsToWordPairs([
      { term: 'alles', definition: 'iologiste', termLang: 'nl', defLang: 'fr', confidence: 'medium' },
      { term: 'alles', definition: 'tout', termLang: 'nl', defLang: 'fr', confidence: 'high' },
      { term: 'fuif', definition: 'soirée', termLang: 'nl', defLang: 'fr', confidence: 'low' },
    ]);
    expect(mapped.some((p) => p.definition === 'iologiste')).toBe(false);
    expect(mapped.some((p) => p.definition === 'tout')).toBe(true);
    expect(mapped.some((p) => p.term === 'fuif')).toBe(false);
  });

  it('rejects invalid payload', () => {
    expect(parseAiExtractResponse(null)).toBeNull();
    expect(parseAiExtractResponse({ pairs: [] })).toBeNull();
  });
});
