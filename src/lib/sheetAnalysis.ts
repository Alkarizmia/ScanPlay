import { analyzeSheetWithAi, collectIgnoredAiPairs, isAiScanEnabled, mapAiPairsToWordPairs } from './aiExtract';
import { reconcileWordListPairs } from './columnParser';
import { extractTextFromImage } from './ocr';
import { parseContent } from './parser';
import { canOpenGamePath, coercePlayablePairs } from './vocabulary';
import type { SheetType, WordPair } from '../types';

export { isAiScanEnabled } from './aiExtract';

export type ExtractSource = 'ai' | 'ocr';

export interface ExtractPairsResult {
  pairs: WordPair[];
  source: ExtractSource;
  ignored?: WordPair[];
}

async function extractViaOcr(file: File, sheetType: SheetType): Promise<WordPair[]> {
  const text = await extractTextFromImage(file, sheetType);
  const raw = parseContent(text, sheetType);
  return coercePlayablePairs(raw);
}

export async function extractPairsFromImage(
  file: File,
  sheetType: SheetType,
): Promise<ExtractPairsResult> {
  if (isAiScanEnabled()) {
    try {
      const ai = await analyzeSheetWithAi(file, sheetType);
      if (ai?.pairs.length) {
        const mapped = mapAiPairsToWordPairs(ai.pairs);
        const ignored = collectIgnoredAiPairs(ai.pairs);
        const sourceHint = ai.pairs.map((p) => `${p.term}\t${p.definition}`).join('\n');
        const pairs = coercePlayablePairs(reconcileWordListPairs(mapped, sourceHint));
        if (canOpenGamePath(pairs)) {
          return { pairs, source: 'ai', ignored };
        }
      }
    } catch {
      /* fallback OCR */
    }
  }

  const pairs = await extractViaOcr(file, sheetType);
  return { pairs, source: 'ocr' };
}
