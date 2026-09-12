import { describe, expect, it } from 'vitest';
import { mapAiPairsToWordPairs } from './aiExtract';
import { enrichTeachablePairs, dropSameLanguageOutliers } from './pairQuality';
import { detectScanLang, looksEn, looksFr } from './scanLang';
import {
  mergeWrappedColumnLines,
  pairsFromVisionWords,
  syntheticTwoColumnWords,
} from './visionColumnPair';

const EN_FR_PHRASE_SHEET: Array<[string, string]> = [
  ['I am coming', "J'arrive"],
  ['My head aches', "J'ai mal à la tête"],
  ['I am early', 'Je suis en avance'],
  ['I am late', 'Je suis en retard'],
  ['I am leaving', "Je m'en vais"],
  ['Who is it?', "De qui s'agit-il ?"],
  ['I work hard', 'Je travaille dur'],
  ['Leave it here', 'Laisse-le ici'],
  ["I don't like it", "Je n'aime pas ça"],
  ['No, not at all', 'Non, pas du tout'],
  ['Well done!', 'Bien fait!'],
  ['Be patient', 'Sois patient'],
  ['I am ready', 'Je suis prêt(e)'],
  ["It's funny", "C'est marrant"],
  ["It's very easy", "C'est très facile"],
  ["It's very difficult", "C'est très difficile"],
  ['Who knows?', 'Qui sait?'],
  ["I don't care", "Ça m'est égal"],
];

describe('scanLang alignment', () => {
  it('detects EN↔FR phrase cells', () => {
    expect(looksEn('I am coming')).toBe(true);
    expect(looksFr("J'arrive")).toBe(true);
    expect(detectScanLang('Who is it?')).toBe('en');
    expect(detectScanLang("De qui s'agit-il ?")).toBe('fr');
  });
});

describe('visionColumnPair', () => {
  it('pairs 18 synthetic EN↔FR rows by geometry', () => {
    const words = syntheticTwoColumnWords(EN_FR_PHRASE_SHEET);
    const pairs = pairsFromVisionWords(words);
    expect(pairs.length).toBeGreaterThanOrEqual(17);
    expect(pairs.some((p) => /coming/i.test(p.term) && /arrive/i.test(p.definition))).toBe(true);
    expect(pairs.some((p) => /Who is it/i.test(p.term))).toBe(true);
  });

  it('merges wrapped continuation lines in a column', () => {
    const merged = mergeWrappedColumnLines(
      [
        { text: "I don't", cy: 100 },
        { text: 'like it', cy: 112 },
        { text: 'Be patient', cy: 140 },
      ],
      34,
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]?.text).toMatch(/don't like it/i);
  });
});

describe('phrase sheet client path (Vision-like payload)', () => {
  it('keeps ~18 bilingual phrases through map + enrich + same-lang filter', () => {
    const aiPairs = EN_FR_PHRASE_SHEET.map(([term, definition]) => ({
      term,
      definition,
      termLang: 'en' as const,
      defLang: 'fr' as const,
      confidence: 'high' as const,
      faces: [] as string[],
    }));

    const mapped = mapAiPairsToWordPairs(aiPairs);
    const enriched = enrichTeachablePairs(mapped);
    const cleaned = dropSameLanguageOutliers(enriched);

    expect(mapped.length).toBeGreaterThanOrEqual(16);
    expect(enriched.length).toBeGreaterThanOrEqual(16);
    expect(cleaned.length).toBeGreaterThanOrEqual(16);
    expect(cleaned.every((p) => p.termLang === 'en' || looksEn(p.term))).toBe(true);
    expect(cleaned.some((p) => /Who is it/i.test(p.term))).toBe(true);
    expect(cleaned.some((p) => p.term === "J'arrive")).toBe(false);
  });
});
