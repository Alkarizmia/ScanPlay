import { isAbortError, throwIfAborted } from './abort';
import { analyzeSheetWithAi, collectIgnoredAiPairs, isAiScanEnabled, mapAiPairsToWordPairs } from './aiExtract';
import { collectGlossedLabelsFromText, reconcileWordListPairs } from './columnParser';
import { extractTextFromImage } from './ocr';
import { parseContent } from './parser';
import { getMaxWords } from './planLimits';
import { dropSameLanguageOutliers } from './pairQuality';
import {
  isFusedRowPair,
  sanitizeVocabExtractPairs,
  vocabTermDedupeKey,
} from './vocabOcrCleanup';
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

function pairTermKey(pair: WordPair): string {
  return vocabTermDedupeKey(pair.term) || pair.term.toLowerCase().trim();
}

function finalizeVocabPairs(pairs: WordPair[], maxPairs: number): WordPair[] {
  const sanitized = sanitizeVocabExtractPairs(pairs).map((p) => ({
    term: String(p.term ?? ''),
    definition: String(p.definition ?? ''),
    termLang: p.termLang as WordPair['termLang'],
    defLang: p.defLang as WordPair['defLang'],
    faces: p.faces,
    quality: ((p as WordPair).quality ?? 'trusted') as WordPair['quality'],
  }));
  return dropSameLanguageOutliers(sanitized).slice(0, maxPairs);
}

/** Prefer AI order; append OCR-only rows so a thin AI sample (e.g. 8) can still grow to full sheet. */
export function mergeAiAndOcrPairs(aiPairs: WordPair[], ocrPairs: WordPair[], maxPairs: number): WordPair[] {
  const out: WordPair[] = [];
  const seen = new Set<string>();
  for (const pair of [...aiPairs, ...ocrPairs]) {
    const key = pairTermKey(pair);
    if (!key || seen.has(key)) continue;
    /* Never keep consecutive full-row mash as a card. */
    if (isFusedRowPair(pair.term, pair.definition)) continue;
    seen.add(key);
    out.push(pair);
    if (out.length >= maxPairs) break;
  }
  return out;
}

function pickMergedResult(
  aiResult: ExtractPairsResult,
  ocrPairs: WordPair[],
  maxPairs: number,
  options?: { freeText?: boolean },
): ExtractPairsResult {
  if (!options?.freeText) {
    const aiClean = finalizeVocabPairs(aiResult.pairs, maxPairs);
    /*
     * Bottom-of-sheet OCR often emits full rows ("To have avoir") then pairs them with the
     * next row. If AI already covered the sheet, merging OCR re-introduces that mash (24→32).
     */
    if (aiClean.length >= 12) {
      return { ...aiResult, pairs: aiClean, source: 'ai' };
    }
    const ocrClean = finalizeVocabPairs(ocrPairs, maxPairs);
    const merged = mergeAiAndOcrPairs(aiClean, ocrClean, maxPairs);
    const pairs = finalizeVocabPairs(merged, maxPairs);
    if (pairs.length <= aiClean.length) {
      return { ...aiResult, pairs: aiClean, source: 'ai' };
    }
    return {
      pairs,
      source: 'ocr',
      ignored: aiResult.ignored,
    };
  }

  const merged = mergeAiAndOcrPairs(aiResult.pairs, ocrPairs, maxPairs);
  const pairs = merged.slice(0, maxPairs);
  if (pairs.length <= aiResult.pairs.length) {
    return { ...aiResult, pairs: aiResult.pairs.slice(0, maxPairs) };
  }
  return {
    pairs,
    source: 'ocr',
    ignored: aiResult.ignored,
  };
}

export async function extractPairsFromImage(
  file: File,
  sheetType: SheetType,
  signal?: AbortSignal,
): Promise<ExtractPairsResult> {
  throwIfAborted(signal);
  let aiResult: ExtractPairsResult | null = null;
  let freeText = false;

  if (isAiScanEnabled()) {
    try {
      const ai = await analyzeSheetWithAi(file, sheetType, signal);
      throwIfAborted(signal);
      if (ai?.pairs.length) {
        const mathSheet = sheetType === 'math' || ai.sheetType === 'math';
        const resolvedType = ai.sheetType ?? sheetType;
        freeText = !mathSheet && (resolvedType === 'notes' || resolvedType === 'definitions');
        const mapped = mapAiPairsToWordPairs(ai.pairs, { mathSheet, freeText });
        const ignored = collectIgnoredAiPairs(ai.pairs, { mathSheet, freeText });
        let pairs: WordPair[];
        if (mathSheet) {
          pairs = coercePlayablePairs(mapped, { mathSheet: true });
        } else if (freeText) {
          pairs = coercePlayablePairs(mapped);
        } else {
          const fromVision = (ai.warnings ?? []).some(
            (w) =>
              w.includes('vision_ocr') ||
              w.includes('vision_only') ||
              w.includes('vision-first') ||
              w.includes('vision_plus_light_gpt') ||
              w.includes('gpt_primary') ||
              w.includes('gpt-primary'),
          );
          if (fromVision) {
            pairs = coercePlayablePairs(mapped);
          } else {
            pairs = coercePlayablePairs(
              reconcileWordListPairs(
                mapped,
                ai.pairs.map((p) => `${p.term}\t${p.definition}`).join('\n'),
              ),
            );
          }
          pairs = finalizeVocabPairs(pairs, getMaxWords());
        }
        if (canOpenGamePath(pairs, mathSheet ? { mathSheet: true } : undefined)) {
          if (mathSheet) {
            return { pairs, source: 'ai', ignored };
          }
          /* Définitions/formules: keep AI result — skip slow Tesseract on formula tables. */
          if (sheetType === 'definitions') {
            return { pairs, source: 'ai', ignored };
          }
          if ((ai.warnings ?? []).some((w) => w.startsWith('vision_') || w.startsWith('final_'))) {
            console.info('[scan-pipeline]', {
              warnings: ai.warnings,
              mapped: mapped.length,
              final: pairs.length,
            });
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

  /* Formules / définitions-formules: never fall back to Tesseract (slow + junk on LaTeX). */
  if (sheetType === 'math' || sheetType === 'definitions') {
    if (aiResult) return aiResult;
    return { pairs: [], source: 'ai' };
  }

  try {
    const ocrPairs = await extractViaOcr(file, sheetType, signal);
    throwIfAborted(signal);
    if (aiResult) {
      return pickMergedResult(aiResult, ocrPairs, getMaxWords(), { freeText });
    }
    const isVocabLike = !freeText && sheetType !== 'notes' && sheetType !== 'definitions' && sheetType !== 'math';
    return {
      pairs: isVocabLike ? finalizeVocabPairs(ocrPairs, getMaxWords()) : ocrPairs,
      source: 'ocr',
    };
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (aiResult) {
      return {
        ...aiResult,
        pairs: (freeText ? aiResult.pairs : finalizeVocabPairs(aiResult.pairs, getMaxWords())).slice(
          0,
          getMaxWords(),
        ),
      };
    }
    throw error;
  }
}
