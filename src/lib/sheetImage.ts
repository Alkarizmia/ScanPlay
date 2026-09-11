/** Crop a phone photo down to the printed sheet before OCR / vision. */

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

/** iPhone Photos / Files often hand HEIC; many browsers cannot draw it until converted. */
export function looksLikeHeic(file: Blob & { name?: string; type?: string }): boolean {
  const type = (file.type || '').toLowerCase();
  if (
    type === 'image/heic' ||
    type === 'image/heif' ||
    type === 'image/heic-sequence' ||
    type === 'image/heif-sequence'
  ) {
    return true;
  }
  return /\.(heic|heif)$/i.test(file.name || '');
}

/** ISO-BMFF brand at byte 8 (ftyp…) — catches empty MIME from some iOS picks. */
export async function sniffHeicBrand(file: Blob): Promise<boolean> {
  try {
    const buf = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.length < 12) return false;
    const tag = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (tag !== 'ftyp') return false;
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    return /^(heic|heix|hevc|hevx|heim|heis|hevm|hevs|mif1|msf1)$/.test(brand);
  } catch {
    return false;
  }
}

async function needsHeicConversion(file: File): Promise<boolean> {
  if (looksLikeHeic(file)) return true;
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('image/') && type !== 'application/octet-stream') return false;
  return sniffHeicBrand(file);
}

/**
 * Same pipeline for every device: convert HEIC→JPEG when needed.
 * JPEG/PNG/WebP pass through unchanged (Android path stays identical).
 */
export async function normalizeSheetFile(file: File): Promise<File> {
  if (!(await needsHeicConversion(file))) return file;
  try {
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
  } catch {
    /* Keep original; decode may still work on some Safari builds. */
    return file;
  }
}

interface DecodedSheet {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

async function decodeViaImageElement(file: Blob): Promise<DecodedSheet> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (width < 8 || height < 8) {
        fail();
        return;
      }
      resolve({
        source: img,
        width,
        height,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = fail;
    img.src = url;
  });
}

async function decodeSheetFile(file: Blob): Promise<DecodedSheet> {
  if (typeof createImageBitmap === 'function') {
    const optionSets: ImageBitmapOptions[] = [{ imageOrientation: 'from-image' }, {}];
    for (const options of optionSets) {
      try {
        const bitmap = await createImageBitmap(file, options);
        if (bitmap.width >= 8 && bitmap.height >= 8) {
          return {
            source: bitmap,
            width: bitmap.width,
            height: bitmap.height,
            cleanup: () => bitmap.close(),
          };
        }
        bitmap.close();
      } catch {
        /* try next / Image() */
      }
    }
  }
  return decodeViaImageElement(file);
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.size > 0) resolve(blob);
        else reject(new Error('Encode failed'));
      },
      'image/jpeg',
      quality,
    );
  });
}

async function prepareSheetImageOnce(
  file: Blob,
  options: { maxSide: number; quality: number; contrast?: boolean },
): Promise<PreparedSheetImage> {
  const decoded = await decodeSheetFile(file);
  const work = document.createElement('canvas');
  const out = document.createElement('canvas');

  try {
    const workSide = Math.min(2200, Math.max(options.maxSide, Math.round(options.maxSide * 0.85 + 400)));
    const { w: dw, h: dh } = scaleToMaxSide(decoded.width, decoded.height, workSide);
    work.width = dw;
    work.height = dh;
    const workCtx = work.getContext('2d', { willReadFrequently: true });
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
      /* tainted canvas or getImageData unavailable — use full frame */
    }

    const { w, h } = scaleToMaxSide(sw, sh, options.maxSide);
    out.width = w;
    out.height = h;
    const outCtx = out.getContext('2d');
    if (!outCtx) throw new Error('Canvas unavailable');
    if (options.contrast) {
      outCtx.filter = 'contrast(1.14) saturate(1.04) brightness(1.03)';
    }
    outCtx.drawImage(work, sx, sy, sw, sh, 0, 0, w, h);
    outCtx.filter = 'none';
    const blob = await canvasToJpeg(out, options.quality);
    return { blob, width: w, height: h };
  } finally {
    decoded.cleanup();
    work.width = 0;
    work.height = 0;
    out.width = 0;
    out.height = 0;
  }
}

/**
 * Normalize (HEIC→JPEG) then prepare. Retries with smaller canvas if memory/encode fails
 * (common on iOS Safari with large Photos). First successful attempt wins — Android JPEG
 * usually succeeds on the first try with unchanged settings.
 */
export async function prepareSheetImage(
  file: File,
  options?: { maxSide?: number; quality?: number; contrast?: boolean },
): Promise<PreparedSheetImage> {
  const normalized = await normalizeSheetFile(file);
  const maxSide = options?.maxSide ?? 2000;
  const quality = options?.quality ?? 0.86;
  const contrast = options?.contrast;

  const attempts: Array<{ maxSide: number; quality: number }> = [
    { maxSide, quality },
    { maxSide: Math.min(maxSide, 1400), quality: Math.min(quality, 0.82) },
    { maxSide: Math.min(maxSide, 1100), quality: Math.min(quality, 0.78) },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await prepareSheetImageOnce(normalized, { ...attempt, contrast });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Image prepare failed');
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
