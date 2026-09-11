/** Crop a phone photo down to the printed sheet before OCR / vision. */

import { getScanPlatform, isIosScanClient } from './scanPlatform';

export interface ContentBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PreparedSheetImage {
  blob: Blob;
  width: number;
  height: number;
}

const TEXT_CELL = 16;

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Bounding box of cells that look like ink on paper (bright + local contrast).
 * Returns null when the whole frame is already the sheet (screenshot) or no text is found.
 */
export function contentBoundingBox(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): ContentBox | null {
  if (width < 80 || height < 80) return null;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hits = 0;

  for (let cy = 0; cy < height; cy += TEXT_CELL) {
    for (let cx = 0; cx < width; cx += TEXT_CELL) {
      let minL = 255;
      let maxL = 0;
      let sum = 0;
      let n = 0;
      const yEnd = Math.min(height, cy + TEXT_CELL);
      const xEnd = Math.min(width, cx + TEXT_CELL);
      for (let y = cy; y < yEnd; y += 2) {
        for (let x = cx; x < xEnd; x += 2) {
          const i = (y * width + x) * 4;
          const l = luminance(pixels[i], pixels[i + 1], pixels[i + 2]);
          if (l < minL) minL = l;
          if (l > maxL) maxL = l;
          sum += l;
          n += 1;
        }
      }
      if (n === 0) continue;
      const mean = sum / n;
      const range = maxL - minL;
      if (mean < 118 || range < 38) continue;
      hits += 1;
      if (cx < minX) minX = cx;
      if (cy < minY) minY = cy;
      if (xEnd > maxX) maxX = xEnd;
      if (yEnd > maxY) maxY = yEnd;
    }
  }

  if (hits < 6) return null;

  const rawW = maxX - minX;
  const rawH = maxY - minY;
  const padX = Math.round(rawW * 0.06);
  const padY = Math.round(rawH * 0.06);
  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);
  const w = Math.min(width - x, rawW + 2 * padX);
  const h = Math.min(height - y, rawH + 2 * padY);
  if (w < 80 || h < 80) return null;

  const area = (w * h) / (width * height);
  if (area > 0.92 || area < 0.08) return null;
  return { x, y, w, h };
}

export function scaleToMaxSide(width: number, height: number, maxSide: number): { w: number; h: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height, 1));
  return {
    w: Math.max(1, Math.round(width * scale)),
    h: Math.max(1, Math.round(height * scale)),
  };
}

/** Explicit HEIC/HEIF only — no brand sniff (that previously touched Android). */
export function isExplicitHeicOrHeif(file: Blob & { name?: string; type?: string }): boolean {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/heic' || type === 'image/heif') return true;
  return /\.(heic|heif)$/i.test(file.name || '');
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default;
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!(blob instanceof Blob) || blob.size < 32) return file;
  const base = (file.name || 'scan').replace(/\.(heic|heif)$/i, '') || 'scan';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
}

interface DecodedSheet {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
  method: 'createImageBitmap' | 'image-element';
}

async function decodeSheetFile(file: File): Promise<DecodedSheet> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
        method: 'createImageBitmap',
      };
    } catch {
      /* Image() fallback */
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(url),
        method: 'image-element',
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Encode failed'));
      },
      'image/jpeg',
      quality,
    );
  });
}

/** Exact 7aa0daa geometry (maxSide floor 1600 work canvas, desk-crop, EXIF from-image). */
async function prepareSheetImageCore(
  file: File,
  options?: { maxSide?: number; quality?: number; contrast?: boolean },
): Promise<PreparedSheetImage & { decodeMethod: DecodedSheet['method'] }> {
  const maxSide = options?.maxSide ?? 2000;
  const quality = options?.quality ?? 0.86;
  const decoded = await decodeSheetFile(file);
  const work = document.createElement('canvas');
  const out = document.createElement('canvas');

  try {
    const { w: dw, h: dh } = scaleToMaxSide(decoded.width, decoded.height, Math.max(maxSide, 1600));
    work.width = dw;
    work.height = dh;
    const workCtx = work.getContext('2d');
    if (!workCtx) throw new Error('Canvas unavailable');
    workCtx.drawImage(decoded.source, 0, 0, dw, dh);

    let sx = 0;
    let sy = 0;
    let sw = dw;
    let sh = dh;
    try {
      const sample = workCtx.getImageData(0, 0, dw, dh);
      const box = contentBoundingBox(sample.data, dw, dh);
      if (box) {
        sx = box.x;
        sy = box.y;
        sw = box.w;
        sh = box.h;
      }
    } catch {
      /* tainted canvas or getImageData unavailable */
    }

    const { w, h } = scaleToMaxSide(sw, sh, maxSide);
    out.width = w;
    out.height = h;
    const outCtx = out.getContext('2d');
    if (!outCtx) throw new Error('Canvas unavailable');
    if (options?.contrast) {
      outCtx.filter = 'contrast(1.14) saturate(1.04) brightness(1.03)';
    }
    outCtx.drawImage(work, sx, sy, sw, sh, 0, 0, w, h);
    outCtx.filter = 'none';
    const blob = await canvasToJpeg(out, quality);
    return { blob, width: w, height: h, decodeMethod: decoded.method };
  } finally {
    decoded.cleanup();
    work.width = 0;
    work.height = 0;
    out.width = 0;
    out.height = 0;
  }
}

/**
 * Proven Android / Windows / other prepare path — behavior identical to 7aa0daa.
 * Do not change workSide, EXIF options, or desk-crop here for iOS experiments.
 */
export async function prepareSheetImageProven(
  file: File,
  options?: { maxSide?: number; quality?: number; contrast?: boolean },
): Promise<PreparedSheetImage> {
  const prepared = await prepareSheetImageCore(file, options);
  console.info('[scan-prepare]', {
    platform: getScanPlatform(),
    path: 'proven',
    decodeMethod: prepared.decodeMethod,
    fileType: file.type || '',
  });
  return { blob: prepared.blob, width: prepared.width, height: prepared.height };
}

/**
 * iOS-only fork: optional explicit HEIC→JPEG, then the same proven geometry.
 * Smaller encode retries stay inside this function only.
 */
export async function prepareSheetImageIos(
  file: File,
  options?: { maxSide?: number; quality?: number; contrast?: boolean },
): Promise<PreparedSheetImage> {
  let input = file;
  let heicConverted = false;
  if (isExplicitHeicOrHeif(file)) {
    try {
      input = await convertHeicToJpeg(file);
      heicConverted = input !== file;
    } catch {
      /* Keep original; Safari may still decode some HEIC. */
    }
  }

  const maxSide = options?.maxSide ?? 2000;
  const quality = options?.quality ?? 0.86;
  const contrast = options?.contrast;

  const attempts: Array<{ maxSide: number; quality: number }> = [
    { maxSide, quality },
    { maxSide: Math.min(maxSide, 1400), quality: Math.min(quality, 0.82) },
    { maxSide: Math.min(maxSide, 1100), quality: Math.min(quality, 0.78) },
  ];

  let lastError: unknown;
  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i]!;
    try {
      const prepared = await prepareSheetImageCore(input, { ...attempt, contrast });
      console.info('[scan-prepare]', {
        platform: 'ios',
        path: 'ios',
        decodeMethod: heicConverted ? `heic2any+${prepared.decodeMethod}` : prepared.decodeMethod,
        fileType: file.type || '',
        attempt: i + 1,
      });
      return { blob: prepared.blob, width: prepared.width, height: prepared.height };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Image prepare failed');
}

/** Which prepare implementation the public router will call (for tests / diagnostics). */
export function resolveSheetPrepareFn(): typeof prepareSheetImageProven {
  return isIosScanClient() ? prepareSheetImageIos : prepareSheetImageProven;
}

/** Router: iOS → prepareSheetImageIos; Android / Windows / other → proven path unchanged. */
export async function prepareSheetImage(
  file: File,
  options?: { maxSide?: number; quality?: number; contrast?: boolean },
): Promise<PreparedSheetImage> {
  return resolveSheetPrepareFn()(file, options);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
