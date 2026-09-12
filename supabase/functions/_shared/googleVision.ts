/**
 * Google Cloud Vision OCR for ScanPlay sheets.
 * Uses DOCUMENT_TEXT_DETECTION + geometry to rebuild 2-column vocab rows.
 */

export interface VisionOcrPair {
  term: string;
  definition: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface VisionOcrResult {
  pairs: VisionOcrPair[];
  fullText: string;
  warnings: string[];
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
    .trim();
}

function looksLikeNoise(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return true;
  if (/^follow me/i.test(t)) return true;
  if (/^page\s*\d+/i.test(t)) return true;
  return false;
}

/** Split dual-column sheet lines into term/definition using x geometry. */
export function pairsFromVisionWords(words: VisionWord[]): VisionOcrPair[] {
  if (words.length < 4) return [];
  const xs = words.map((w) => w.cx).sort((a, b) => a - b);
  const midX = xs[Math.floor(xs.length / 2)] ?? 0;
  const lines = clusterLines(words);
  const pairs: VisionOcrPair[] = [];

  for (const line of lines) {
    const left = line.filter((w) => w.cx < midX);
    const right = line.filter((w) => w.cx >= midX);
    const term = joinWords(left);
    const definition = joinWords(right);
    if (!term || !definition) continue;
    if (looksLikeNoise(term) || looksLikeNoise(definition)) continue;
    if (term.toLowerCase() === definition.toLowerCase()) continue;
    /* Skip single-column leftovers (whole line fell on one side). */
    if (left.length === 0 || right.length === 0) continue;
    pairs.push({
      term: term.replace(/[.\s]+$/g, '').trim(),
      definition: definition.replace(/[.\s]+$/g, '').trim(),
      confidence: 'high',
    });
  }

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
  if (!raw) return null;
  const sa = parseServiceAccount(raw);
  if (!sa) {
    console.error('[google-vision] invalid GOOGLE_SERVICE_ACCOUNT_JSON');
    return null;
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
      return null;
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
      return null;
    }

    const fullTextAnnotation = response?.fullTextAnnotation;
    const fullText =
      (typeof fullTextAnnotation?.text === 'string' ? fullTextAnnotation.text : '') ||
      response?.textAnnotations?.[0]?.description ||
      '';

    const words = fullTextAnnotation ? collectWords(fullTextAnnotation) : [];
    const pairs = pairsFromVisionWords(words);
    const warnings: string[] = [];
    if (pairs.length === 0 && fullText) warnings.push('vision_no_column_pairs');
    if (pairs.length > 0) warnings.push('vision_ocr');

    console.info('[google-vision]', { words: words.length, pairs: pairs.length });
    return { pairs, fullText: fullText.trim(), warnings };
  } catch (error) {
    console.error('[google-vision] exception', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Strong 2-column OCR → GPT can use low image detail / skip recount. */
export function visionOcrIsStrong(sheetType: string, pairCount: number): boolean {
  if (sheetType !== 'vocab') return false;
  return pairCount >= 10;
}
