/**
 * Pure 2-column Vision geometry (testable in Vitest).
 * Keep algorithm aligned with supabase/functions/_shared/googleVision.ts.
 */

export interface VisionWordBox {
  text: string;
  cx: number;
  cy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface VisionColumnPair {
  term: string;
  definition: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ColumnLine {
  text: string;
  cy: number;
}

function clusterLines(words: VisionWordBox[]): VisionWordBox[][] {
  if (words.length === 0) return [];
  const sorted = [...words].sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  const heights = sorted.map((w) => Math.max(8, w.maxY - w.minY)).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] ?? 16;
  const yTol = Math.max(10, medianH * 0.55);

  const lines: VisionWordBox[][] = [];
  let current: VisionWordBox[] = [];
  let currentY = sorted[0]!.cy;

  for (const word of sorted) {
    if (current.length === 0 || Math.abs(word.cy - currentY) <= yTol) {
      current.push(word);
      currentY = current.reduce((s, w) => s + w.cy, 0) / current.length;
    } else {
      lines.push(current);
      current = [word];
      currentY = word.cy;
    }
  }
  if (current.length) lines.push(current);
  return lines;
}

function joinWords(words: VisionWordBox[]): string {
  return words
    .slice()
    .sort((a, b) => a.cx - b.cx)
    .map((w) => w.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([?!.,;:])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+-\s+/g, '-')
    .trim();
}

function cleanCell(text: string): string {
  return text
    .replace(/[.\s]+$/g, '')
    .replace(/^[.\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeNoise(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return true;
  if (/^follow me/i.test(t)) return true;
  if (/^for more/i.test(t)) return true;
  if (/^page\s*\d+/i.test(t)) return true;
  return false;
}

export function findColumnSplitX(words: VisionWordBox[]): number {
  const xs = words.map((w) => w.cx).sort((a, b) => a - b);
  if (xs.length < 4) return xs[Math.floor(xs.length / 2)] ?? 0;
  const pageMid = (xs[0]! + xs[xs.length - 1]!) / 2;
  let bestScore = -1;
  let bestAt = xs[Math.floor(xs.length / 2)]!;
  for (let i = 1; i < xs.length; i += 1) {
    const gap = xs[i]! - xs[i - 1]!;
    const at = (xs[i]! + xs[i - 1]!) / 2;
    const centered = 1 - Math.abs(at - pageMid) / (Math.abs(pageMid) || 1);
    const score = gap * (0.45 + 0.55 * Math.max(0, centered));
    if (score > bestScore) {
      bestScore = score;
      bestAt = at;
    }
  }
  return bestAt;
}

/** Merge wrapped continuation lines inside one column (e.g. "I don't" + "like it"). */
export function mergeWrappedColumnLines(lines: ColumnLine[], rowGap: number): ColumnLine[] {
  if (lines.length < 2) return lines.map((l) => ({ ...l }));
  const maxWrapDy = Math.max(14, rowGap * 0.55);
  const out: ColumnLine[] = [];

  for (const line of lines) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push({ ...line });
      continue;
    }
    const dy = Math.abs(line.cy - prev.cy);
    const prevEnds = /[.?!…]$/.test(prev.text);
    const nextStartsLower = /^[a-zà-ÿ(]/.test(line.text);
    const hyphen = /-$/.test(prev.text);
    const shortCont = line.text.split(/\s+/).length <= 3 && !/^[A-ZÀ-Ÿ]/.test(line.text);
    const shouldMerge =
      dy <= maxWrapDy && !prevEnds && (nextStartsLower || hyphen || shortCont);
    if (shouldMerge) {
      prev.text = cleanCell(`${prev.text} ${line.text}`);
      prev.cy = (prev.cy + line.cy) / 2;
    } else {
      out.push({ ...line });
    }
  }
  return out;
}

function toColumnLines(words: VisionWordBox[]): ColumnLine[] {
  const clustered = clusterLines(words)
    .map((line) => ({
      text: cleanCell(joinWords(line)),
      cy: line.reduce((s, w) => s + w.cy, 0) / line.length,
    }))
    .filter((l) => l.text.length >= 2 && !looksLikeNoise(l.text));
  if (clustered.length < 2) return clustered;
  const rowGap = Math.abs(clustered[1]!.cy - clustered[0]!.cy);
  return mergeWrappedColumnLines(clustered, rowGap);
}

export function pairsFromVisionWords(words: VisionWordBox[]): VisionColumnPair[] {
  if (words.length < 4) return [];
  const midX = findColumnSplitX(words);
  const leftLines = toColumnLines(words.filter((w) => w.cx < midX));
  const rightLines = toColumnLines(words.filter((w) => w.cx >= midX));
  if (leftLines.length < 2 || rightLines.length < 2) return [];

  const rowGap =
    leftLines.length >= 2 ? Math.abs(leftLines[1]!.cy - leftLines[0]!.cy) : 40;
  const maxDy = Math.max(28, rowGap * 0.75);

  const usedRight = new Set<number>();
  const pairs: VisionColumnPair[] = [];

  for (const left of leftLines) {
    let bestIdx = -1;
    let bestDy = Number.POSITIVE_INFINITY;
    for (let i = 0; i < rightLines.length; i += 1) {
      if (usedRight.has(i)) continue;
      const dy = Math.abs(left.cy - rightLines[i]!.cy);
      if (dy < bestDy) {
        bestDy = dy;
        bestIdx = i;
      }
    }
    if (bestIdx < 0 || bestDy > maxDy) continue;
    const right = rightLines[bestIdx]!;
    usedRight.add(bestIdx);
    if (left.text.toLowerCase() === right.text.toLowerCase()) continue;
    if (looksLikeNoise(left.text) || looksLikeNoise(right.text)) continue;
    pairs.push({
      term: left.text,
      definition: right.text,
      confidence: bestDy <= maxDy * 0.45 ? 'high' : 'medium',
    });
  }

  /* Rank-order fallback for leftover rows with similar counts. */
  const leftOrphans = leftLines.filter(
    (l) => !pairs.some((p) => p.term === l.text) && !looksLikeNoise(l.text),
  );
  const rightOrphans = rightLines.filter((_, i) => !usedRight.has(i));
  const orphanCap = Math.min(leftOrphans.length, rightOrphans.length);
  for (let i = 0; i < orphanCap; i += 1) {
    const left = leftOrphans[i]!;
    const right = rightOrphans[i]!;
    const dy = Math.abs(left.cy - right.cy);
    if (dy > Math.max(maxDy * 1.35, rowGap * 1.2)) continue;
    if (left.text.toLowerCase() === right.text.toLowerCase()) continue;
    pairs.push({
      term: left.text,
      definition: right.text,
      confidence: 'low',
    });
  }

  return pairs;
}

/** Build synthetic 2-column word boxes for tests. */
export function syntheticTwoColumnWords(
  rows: Array<[string, string]>,
  opts?: { leftX?: number; rightX?: number; rowH?: number },
): VisionWordBox[] {
  const leftX = opts?.leftX ?? 40;
  const rightX = opts?.rightX ?? 260;
  const rowH = opts?.rowH ?? 34;
  const words: VisionWordBox[] = [];
  rows.forEach(([left, right], row) => {
    const cy = 40 + row * rowH;
    for (const [text, cx] of [
      [left, leftX],
      [right, rightX],
    ] as const) {
      text.split(/\s+/).forEach((token, i) => {
        const x = cx + i * 18;
        words.push({
          text: token,
          cx: x,
          cy,
          minX: x - 8,
          maxX: x + 8,
          minY: cy - 8,
          maxY: cy + 8,
        });
      });
    }
  });
  return words;
}
