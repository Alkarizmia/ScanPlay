import type { SheetType, WordPair } from '../types';
import { mergeDualColumnOcr, parseColumnText, isTitleLine } from './columnParser';
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

function parseDefinitionsSheet(lines: string[]): WordPair[] {
  const fromSeparators = lines
    .map(parseLinePair)
    .filter((p): p is WordPair => p !== null && isBasicPair(p));
  if (fromSeparators.length >= 2) return dedupe(fromSeparators);
  return dedupe(parseAdjacentLines(lines));
}

function parseNotesSheet(lines: string[]): WordPair[] {
  const pairs: WordPair[] = [];
  for (const line of lines) {
    const cleaned = cleanLine(line);
    if (!cleaned || isTitleLine(cleaned)) continue;
    const sep = parseLinePair(cleaned);
    if (sep && isBasicPair(sep)) {
      pairs.push(sep);
      continue;
    }
    if (cleaned.length >= 8 && cleaned.length <= 90) {
      pairs.push({ term: cleaned.slice(0, 40), definition: cleaned });
    }
  }
  return dedupe(pairs);
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

  const fromColumns = parseColumnText(text);
  const fromSeparators = lines
    .map(parseLinePair)
    .filter((p): p is WordPair => p !== null && isBasicPair(p));

  let pairs = dedupe([...fromColumns, ...fromSeparators]);

  if (pairs.length < 3) {
    pairs = dedupe([...pairs, ...parseAdjacentLines(lines)]);
  }

  return pairs.slice(0, 32);
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
      return parseDefinitionsSheet(rawLines.filter((l) => !isTitleLine(l))).slice(0, 24);
    case 'notes':
      return parseNotesSheet(rawLines).slice(0, 20);
    case 'math':
      return parseMathSheet(rawLines).slice(0, 24);
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
