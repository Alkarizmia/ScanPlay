/**
 * Google Cloud Vision OCR for ScanPlay sheets.
 * Uses DOCUMENT_TEXT_DETECTION + geometry to rebuild 2-column vocab rows.
 * Geometry algorithm kept aligned with src/lib/visionColumnPair.ts.
 */

import { looksEn, looksFr } from './scanLang.ts';

export interface VisionOcrPair {
  term: string;
  definition: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface VisionOcrResult {
  pairs: VisionOcrPair[];
  fullText: string;
  warnings: string[];
  rawPairCount?: number;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface Vertex {
  x?: number;
  y?: number;
}

interface VisionWord {
  text: string;
  cx: number;
  cy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface ColumnLine {
  text: string;
  cy: number;
}

function b64url(data: string | ArrayBuffer): string {
  const bytes =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-vision',
      aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;
  const tokenRes = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`google_token_${tokenRes.status}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) throw new Error('google_token_missing');
  return tokenJson.access_token;
}

function boxStats(vertices: Vertex[] | undefined): Omit<VisionWord, 'text'> | null {
  if (!vertices || vertices.length < 2) return null;
  const xs = vertices.map((v) => v.x ?? 0);
  const ys = vertices.map((v) => v.y ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    minX,
    maxX,
    minY,
    maxY,
  };
}

function collectWords(annotation: Record<string, unknown>): VisionWord[] {
  const words: VisionWord[] = [];
  const pages = (annotation.pages as Array<Record<string, unknown>> | undefined) ?? [];
  for (const page of pages) {
    const blocks = (page.blocks as Array<Record<string, unknown>> | undefined) ?? [];
    for (const block of blocks) {
      const paragraphs = (block.paragraphs as Array<Record<string, unknown>> | undefined) ?? [];
      for (const paragraph of paragraphs) {
        const wlist = (paragraph.words as Array<Record<string, unknown>> | undefined) ?? [];
        for (const word of wlist) {
          const symbols = (word.symbols as Array<{ text?: string }> | undefined) ?? [];
          const text = symbols.map((s) => s.text ?? '').join('');
          if (!text.trim()) continue;
          const stats = boxStats(
            (word.boundingBox as { vertices?: Vertex[] } | undefined)?.vertices,
          );
          if (!stats) continue;
          words.push({ text, ...stats });
        }
      }
    }
  }
  return words;
}

function clusterLines(words: VisionWord[]): VisionWord[][] {
  if (words.length === 0) return [];
  const sorted = [...words].sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  const heights = sorted.map((w) => Math.max(8, w.maxY - w.minY));
  const medianH = heights.sort((a, b) => a - b)[Math.floor(heights.length / 2)] ?? 16;
  const yTol = Math.max(10, medianH * 0.55);

  const lines: VisionWord[][] = [];
  let current: VisionWord[] = [];
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

function joinWords(words: VisionWord[]): string {
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

/** Prefer bilingual EN↔FR (or clearly different scripts/langs). */
export function isVisionBilingualPair(term: string, definition: string): boolean {
  const enT = looksEn(term);
  const frT = looksFr(term);
  const enD = looksEn(definition);
  const frD = looksFr(definition);
  if ((enT && frD) || (frT && enD)) return true;
  if ((frT && frD && !enT && !enD) || (enT && enD && !frT && !frD)) return false;
  return term.trim().toLowerCase() !== definition.trim().toLowerCase();
}

/** Largest central gap in X → split left/right columns (better than median midX). */
export function findColumnSplitX(words: VisionWord[]): number {
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

function toColumnLines(words: VisionWord[]): ColumnLine[] {
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

/**
 * Split dual-column sheet into term/definition by:
 * 1) finding the gutter between columns
 * 2) clustering each column into lines (+ wrap merge)
 * 3) matching lines by vertical alignment (+ orphan zip)
 */
export function pairsFromVisionWords(words: VisionWord[]): VisionOcrPair[] {
  if (words.length < 4) return [];
  const midX = findColumnSplitX(words);
  const leftLines = toColumnLines(words.filter((w) => w.cx < midX));
  const rightLines = toColumnLines(words.filter((w) => w.cx >= midX));
  if (leftLines.length < 2 || rightLines.length < 2) return [];

  const rowGap =
    leftLines.length >= 2 ? Math.abs(leftLines[1]!.cy - leftLines[0]!.cy) : 40;
  const maxDy = Math.max(28, rowGap * 0.75);

  const usedRight = new Set<number>();
  const pairs: VisionOcrPair[] = [];

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

/** Keep translation-looking rows; drop FR→FR / EN→EN gutter mistakes. */
export function filterBilingualVisionPairs(pairs: VisionOcrPair[]): VisionOcrPair[] {
  const bilingual = pairs.filter((p) => isVisionBilingualPair(p.term, p.definition));
  if (bilingual.length >= 3) return bilingual;
  return pairs;
}

function parseServiceAccount(raw: string): ServiceAccount | null {
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed?.client_email || !parsed?.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function runGoogleVisionOcr(imageBase64: string): Promise<VisionOcrResult | null> {
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!raw) {
    console.error('[google-vision] missing GOOGLE_SERVICE_ACCOUNT_JSON');
    return { pairs: [], fullText: '', warnings: ['vision_secret_missing'], rawPairCount: 0 };
  }
  const sa = parseServiceAccount(raw);
  if (!sa) {
    console.error('[google-vision] invalid GOOGLE_SERVICE_ACCOUNT_JSON');
    return { pairs: [], fullText: '', warnings: ['vision_secret_invalid'], rawPairCount: 0 };
  }

  try {
    const accessToken = await getAccessToken(sa);
    const visionRes = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64.replace(/^data:[^;]+;base64,/, '') },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            imageContext: { languageHints: ['en', 'fr', 'nl', 'es'] },
          },
        ],
      }),
    });

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      console.error('[google-vision] annotate failed', visionRes.status, errText.slice(0, 200));
      return {
        pairs: [],
        fullText: '',
        warnings: [`vision_http_${visionRes.status}`],
        rawPairCount: 0,
      };
    }

    const visionJson = (await visionRes.json()) as {
      responses?: Array<{
        fullTextAnnotation?: Record<string, unknown>;
        textAnnotations?: Array<{ description?: string }>;
        error?: { message?: string };
      }>;
    };
    const response = visionJson.responses?.[0];
    if (response?.error?.message) {
      console.error('[google-vision]', response.error.message);
      return {
        pairs: [],
        fullText: '',
        warnings: ['vision_api_error'],
        rawPairCount: 0,
      };
    }

    const fullTextAnnotation = response?.fullTextAnnotation;
    const fullText =
      (typeof fullTextAnnotation?.text === 'string' ? fullTextAnnotation.text : '') ||
      response?.textAnnotations?.[0]?.description ||
      '';

    const words = fullTextAnnotation ? collectWords(fullTextAnnotation) : [];
    const rawPairs = pairsFromVisionWords(words);
    const pairs = filterBilingualVisionPairs(rawPairs);
    const warnings: string[] = [`vision_raw_${rawPairs.length}`];
    if (pairs.length === 0 && fullText) warnings.push('vision_no_column_pairs');
    if (rawPairs.length > pairs.length) warnings.push('vision_dropped_same_lang');
    if (pairs.length > 0) warnings.push('vision_ocr');

    console.info('[google-vision]', {
      words: words.length,
      rawPairs: rawPairs.length,
      pairs: pairs.length,
    });
    return { pairs, fullText: fullText.trim(), warnings, rawPairCount: rawPairs.length };
  } catch (error) {
    console.error('[google-vision] exception', error instanceof Error ? error.message : error);
    return { pairs: [], fullText: '', warnings: ['vision_exception'], rawPairCount: 0 };
  }
}

/** Strong 2-column OCR → use as Vision-first base. */
export function visionOcrIsStrong(sheetType: string, pairCount: number): boolean {
  if (sheetType !== 'vocab') return false;
  return pairCount >= 10;
}
