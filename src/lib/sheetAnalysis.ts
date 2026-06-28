import { analyzeSheetWithAi, isAiScanEnabled, mapAiPairsToWordPairs } from './aiExtract';
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
        const pairs = coercePlayablePairs(
          reconcileWordListPairs(mapAiPairsToWordPairs(ai.pairs)),
        );
        if (canOpenGamePath(pairs)) {
          return { pairs, source: 'ai' };
        }
      }
    } catch {
      /* fallback OCR */
    }
  }

  const pairs = await extractViaOcr(file, sheetType);
  return { pairs, source: 'ocr' };
}
