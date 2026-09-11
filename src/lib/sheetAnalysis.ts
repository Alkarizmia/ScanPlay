import { isAbortError, throwIfAborted } from './abort';
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

async function extractViaOcr(
  file: File,
  sheetType: SheetType,
  signal?: AbortSignal,
): Promise<WordPair[]> {
  const text = await extractTextFromImage(file, sheetType, signal);
  throwIfAborted(signal);
  const raw = parseContent(text, sheetType);
  return coercePlayablePairs(raw);
}

const MIN_AI_PAIRS_TO_SKIP_OCR = 20;

function pairIdentity(p: WordPair): string {
  return `${p.term.trim().toLowerCase()}\t${p.definition.trim().toLowerCase()}`;
}

/** Union AI + OCR so a thin vision sample does not discard a fuller OCR pass. */
function mergePairSets(a: WordPair[], b: WordPair[]): WordPair[] {
  const seen = new Set<string>();
  const out: WordPair[] = [];
  for (const p of [...a, ...b]) {
    const key = pairIdentity(p);
    if (!p.term.trim() || !p.definition.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function betterPairSet(a: WordPair[], b: WordPair[]): WordPair[] {
  const merged = mergePairSets(a, b);
  if (merged.length >= Math.max(a.length, b.length)) return merged;
  if (a.length >= b.length) return a;
  return b;
}

export async function extractPairsFromImage(
  file: File,
  sheetType: SheetType,
  signal?: AbortSignal,
): Promise<ExtractPairsResult> {
  throwIfAborted(signal);
  let aiResult: ExtractPairsResult | null = null;

  if (isAiScanEnabled()) {
    try {
      const ai = await analyzeSheetWithAi(file, sheetType, signal);
      throwIfAborted(signal);
      if (ai?.pairs.length) {
        const mathSheet = sheetType === 'math' || ai.sheetType === 'math';
        const resolvedType = ai.sheetType ?? sheetType;
        const freeText = !mathSheet && (resolvedType === 'notes' || resolvedType === 'definitions');
        const mapped = mapAiPairsToWordPairs(ai.pairs, { mathSheet, freeText });
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
        if (canOpenGamePath(pairs)) {
          if (mathSheet || pairs.length >= MIN_AI_PAIRS_TO_SKIP_OCR) {
            return { pairs, source: 'ai', ignored };
          }
          aiResult = { pairs, source: 'ai', ignored };
        } else if (!freeText) {
          const fromLabels = collectGlossedLabelsFromText(
            ai.pairs.map((p) => `${p.term} ${p.definition}`).join('\n'),
          );
          if (canOpenGamePath(fromLabels)) {
            aiResult = { pairs: fromLabels, source: 'ai', ignored };
          }
        }
      }
    } catch (error) {
      if (isAbortError(error)) throw error;
      /* fallback OCR */
    }
  }

  throwIfAborted(signal);
  try {
    const ocrPairs = await extractViaOcr(file, sheetType, signal);
    throwIfAborted(signal);
    if (aiResult) {
      const best = betterPairSet(aiResult.pairs, ocrPairs);
      return best === aiResult.pairs ? aiResult : { pairs: ocrPairs, source: 'ocr', ignored: aiResult.ignored };
    }
    return { pairs: ocrPairs, source: 'ocr' };
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (aiResult) return aiResult;
    throw error;
  }
}
