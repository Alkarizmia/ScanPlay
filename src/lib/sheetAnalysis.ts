import { analyzeSheetWithAi, collectIgnoredAiPairs, isAiScanEnabled, mapAiPairsToWordPairs } from './aiExtract';
import { collectGlossedLabelsFromText, reconcileWordListPairs } from './columnParser';
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
      // TEMP DEBUG
      console.log('[SCAN DEBUG] brut IA:', ai?.pairs.length, 'sheetType:', sheetType);
      if (ai?.pairs.length) {
        const mathSheet = sheetType === 'math' || ai.sheetType === 'math';
        const resolvedType = ai.sheetType ?? sheetType;
        const freeText = !mathSheet && (resolvedType === 'notes' || resolvedType === 'definitions');
        const mapped = mapAiPairsToWordPairs(ai.pairs, { mathSheet, freeText });
        // TEMP DEBUG
        console.log('[SCAN DEBUG] apres mapping:', mapped.length);
        const ignored = collectIgnoredAiPairs(ai.pairs, { mathSheet, freeText });
        let pairs: WordPair[];
        if (mathSheet) {
          pairs = coercePlayablePairs(mapped, { mathSheet: true });
        } else if (freeText) {
          pairs = coercePlayablePairs(mapped);
        } else {
          pairs = coercePlayablePairs(
            reconcileWordListPairs(
              mapped,
              ai.pairs.map((p) => `${p.term}\t${p.definition}`).join('\n'),
            ),
          );
        }
        // TEMP DEBUG
        console.log('[SCAN DEBUG] final:', pairs.length);
        if (canOpenGamePath(pairs)) {
          return { pairs, source: 'ai', ignored };
        }
        if (!freeText) {
          const fromLabels = collectGlossedLabelsFromText(
            ai.pairs.map((p) => `${p.term} ${p.definition}`).join('\n'),
          );
          if (canOpenGamePath(fromLabels)) {
            return { pairs: fromLabels, source: 'ai', ignored };
          }
        }
      }
    } catch {
      /* fallback OCR */
    }
  }

  const pairs = await extractViaOcr(file, sheetType);
  return { pairs, source: 'ocr' };
}
