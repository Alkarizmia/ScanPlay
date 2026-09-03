import type { SheetType, WordPair } from '../types';
import {
  detectLayoutFromTitle,
  mergeDualColumnOcr,
  parseColumnText,
  isTitleLine,
  reconcileWordListPairs,
  collectGlossedLabelsFromText,
} from './columnParser';
import { fixOcrLine, isInstructionText } from './vocabulary';

const SEPARATORS = /[-–—:|=•·]/;
const NUMBER_PREFIX = /^\d+[\.\)\]]\s*/;

function cleanLine(line: string): string {
  return fixOcrLine(line.replace(NUMBER_PREFIX, '').trim());
}

function isBasicPair(pair: WordPair): boolean {
  if (pair.term.length < 2 || pair.definition.length < 2) return false;
  if (pair.term.length > 55 || pair.definition.length > 120) return false;
  if (pair.term.toLowerCase() === pair.definition.toLowerCase()) return false;
  if (isInstructionText(pair.term) || isInstructionText(pair.definition)) return false;
  if (isTitleLine(pair.term) || isTitleLine(pair.definition)) return false;
  return true;
}

function parseLinePair(line: string): WordPair | null {
  const cleaned = cleanLine(line);
  if (!cleaned || cleaned.length < 3) return null;

  const parts = cleaned
    .split(SEPARATORS)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return { term: parts[0], definition: parts.slice(1).join(' - ') };
  }
  return null;
}

function parseAdjacentLines(lines: string[]): WordPair[] {
  const pairs: WordPair[] = [];
  const cleaned = lines.map(cleanLine).filter((l) => l.length > 1 && !isTitleLine(l));

  for (let i = 0; i < cleaned.length - 1; i += 1) {
    const a = cleaned[i];
    const b = cleaned[i + 1];
    if (a.length > 45 || b.length > 45) continue;

    const pair = { term: a, definition: b };
    if (!isBasicPair(pair)) continue;
    pairs.push(pair);
    i += 1;
  }
  return pairs;
}

function dedupe(pairs: WordPair[]): WordPair[] {
  const seen = new Set<string>();
  return pairs.filter((p) => {
    const key = `${p.term.toLowerCase()}|${p.definition.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const NOTES_MAX_WORDS = 15;
const DEF_MAX_WORDS = 12;

const KEYWORD_STOP = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'en', 'au', 'aux',
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on',
  'de', 'het', 'een', 'van', 'en', 'of',
  'el', 'los', 'las', 'un', 'una', 'y', 'o',
]);

function clipWords(text: string, max: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(' ');
  return words.slice(0, max).join(' ');
}

function keywordFromSentence(sentence: string): string {
  const words = sentence
    .replace(/[.,;:!?]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !KEYWORD_STOP.has(w.toLowerCase()));
  const best = [...words].sort((a, b) => b.length - a.length)[0];
  if (best) return best;
  return sentence.split(/\s+/).slice(0, 3).join(' ');
}

function parseNotesSheet(lines: string[]): WordPair[] {
  const pairs: WordPair[] = [];
  for (const line of lines) {
    const cleaned = cleanLine(line);
    if (!cleaned || isTitleLine(cleaned)) continue;
    const sep = parseLinePair(cleaned);
    if (sep && isBasicPair(sep)) {
      pairs.push({
        term: clipWords(sep.term, 6),
        definition: clipWords(sep.definition, NOTES_MAX_WORDS),
      });
      continue;
    }
    if (cleaned.length >= 8) {
      const sentence = clipWords(cleaned, NOTES_MAX_WORDS);
      pairs.push({ term: keywordFromSentence(sentence), definition: sentence });
    }
  }
  return dedupe(pairs);
}

function parseDefinitionsSheet(lines: string[]): WordPair[] {
  const fromSeparators = lines
    .map(parseLinePair)
    .filter((p): p is WordPair => p !== null && isBasicPair(p))
    .map((p) => ({
      ...p,
      term: clipWords(p.term, 6),
      definition: clipWords(p.definition, DEF_MAX_WORDS),
    }));
  if (fromSeparators.length >= 2) return dedupe(fromSeparators);
  return dedupe(
    parseAdjacentLines(lines).map((p) => ({
      ...p,
      term: clipWords(p.term, 6),
      definition: clipWords(p.definition, DEF_MAX_WORDS),
    })),
  );
}

function parseMathLinePair(line: string): WordPair | null {
  const cleaned = cleanLine(line);
  if (!cleaned || cleaned.length < 3) return null;

  const labelFormula = cleaned.match(/^(.{2,40}?)\s*[:=\-–—|]\s*(.+)$/);
  if (labelFormula) {
    return { term: labelFormula[1].trim(), definition: labelFormula[2].trim() };
  }

  const sep = parseLinePair(cleaned);
  if (sep) return sep;

  if (/[=+\-×÷*/^√]/.test(cleaned)) {
    return { term: cleaned.slice(0, Math.min(32, cleaned.length)), definition: cleaned };
  }
  return null;
}

function parseMathSheet(lines: string[]): WordPair[] {
  const pairs: WordPair[] = [];
  for (const line of lines) {
    if (isTitleLine(line)) continue;
    const pair = parseMathLinePair(line);
    if (!pair) continue;
    if (pair.term.length < 2 || pair.definition.length < 2) continue;
    if (pair.term.toLowerCase() === pair.definition.toLowerCase()) continue;
    pairs.push(pair);
  }
  return dedupe(pairs);
}

function parseVocabSheet(text: string): WordPair[] {
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => fixOcrLine(l.trim()))
    .filter((l) => l.length > 0);

  const lines = rawLines.filter((line) => !isTitleLine(line));
  const titleLayout = detectLayoutFromTitle(text);

  const fromColumns = parseColumnText(text, titleLayout ?? undefined);
  const fromSeparators = lines
    .map(parseLinePair)
    .filter((p): p is WordPair => p !== null && isBasicPair(p));

  let pairs = dedupe([...fromColumns, ...fromSeparators]);

  if (titleLayout !== 'word_list' && pairs.length < 3) {
    pairs = dedupe([...pairs, ...parseAdjacentLines(lines)]);
  }

  pairs = reconcileWordListPairs(pairs, text);
  const glossedLabels = collectGlossedLabelsFromText(text);
  if (glossedLabels.length >= 4 && glossedLabels.length > pairs.length) {
    return glossedLabels.slice(0, 250);
  }

  return pairs.slice(0, 250);
}

/** Extract pairs from OCR text. */
export function parseContent(text: string, sheetType: SheetType = 'vocab'): WordPair[] {
  if (!text.trim()) return [];

  const rawLines = text
    .split(/\r?\n/)
    .map((l) => fixOcrLine(l.trim()))
    .filter((l) => l.length > 0);

  switch (sheetType) {
    case 'definitions':
      return parseDefinitionsSheet(rawLines.filter((l) => !isTitleLine(l))).slice(0, 250);
    case 'notes':
      return parseNotesSheet(rawLines).slice(0, 250);
    case 'math':
      return parseMathSheet(rawLines).slice(0, 250);
    case 'vocab':
    default:
      return parseVocabSheet(text);
  }
}

/** Merge dual-column OCR output then parse as vocab. */
export function parseDualColumnContent(leftText: string, rightText: string): WordPair[] {
  const merged = mergeDualColumnOcr(leftText, rightText);
  return parseContent(merged, 'vocab');
}

export function hasEnoughPairs(pairs: WordPair[]): boolean {
  return pairs.length >= 1;
}

export function hasMinimumForGames(pairs: WordPair[]): boolean {
  return pairs.length >= 3;
}
