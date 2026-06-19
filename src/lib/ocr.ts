import Tesseract, { PSM } from 'tesseract.js';
import type { SheetType } from '../types';
import { mergeDualColumnOcr } from './columnParser';

const OCR_TIMEOUT_MS = 22_000;

let workerInstance: Tesseract.Worker | null = null;
let workerReady: Promise<Tesseract.Worker> | null = null;
let currentLangs = 'fra+eng';

function withTimeout<T>(promise: Promise<T>, ms: number, label = 'timeout'): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

function langsForSheetType(sheetType: SheetType): string {
  if (sheetType === 'vocab') return 'nld+fra+eng';
  return 'fra+eng';
}

export async function resetOcrWorker(): Promise<void> {
  try {
    if (workerInstance) await workerInstance.terminate();
  } catch {
    /* ignore */
  }
  workerInstance = null;
  workerReady = null;
}

async function getWorker(langs = 'fra+eng'): Promise<Tesseract.Worker> {
  if (workerInstance && currentLangs !== langs) {
    await resetOcrWorker();
  }
  currentLangs = langs;

  if (workerInstance) return workerInstance;
  if (!workerReady) {
    workerReady = withTimeout(
      (async () => {
        try {
          const worker = await Tesseract.createWorker(langs, 1, { logger: () => {} });
          await worker.setParameters({
            tessedit_pageseg_mode: PSM.AUTO,
            preserve_interword_spaces: '1',
          });
          workerInstance = worker;
          return worker;
        } catch {
          const fallback = await Tesseract.createWorker('fra+eng', 1, { logger: () => {} });
          await fallback.setParameters({
            tessedit_pageseg_mode: PSM.AUTO,
            preserve_interword_spaces: '1',
          });
          currentLangs = 'fra+eng';
          workerInstance = fallback;
          return fallback;
        }
      })(),
      OCR_TIMEOUT_MS,
      'worker-init-timeout',
    ).catch(async (err) => {
      workerReady = null;
      await resetOcrWorker();
      throw err;
    });
  }
  return workerReady;
}

export async function warmupOcr(): Promise<void> {
  try {
    await withTimeout(getWorker('nld+fra+eng'), 15_000, 'warmup-timeout');
  } catch {
    await resetOcrWorker();
  }
}

interface SizedImage {
  blob: Blob;
  width: number;
  height: number;
}

function loadSizedImage(file: File, maxWidth = 1200): Promise<SizedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => (blob ? resolve({ blob, width: w, height: h }) : reject(new Error('Resize failed'))),
        'image/jpeg',
        0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

async function cropBlob(source: Blob, sx: number, sy: number, sw: number, sh: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(source);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Crop failed'))),
        'image/jpeg',
        0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Crop load failed'));
    };
    img.src = url;
  });
}

async function recognizeBlob(blob: Blob, langs: string): Promise<string> {
  const worker = await getWorker(langs);
  const result = await withTimeout(worker.recognize(blob), OCR_TIMEOUT_MS, 'recognize-timeout');
  return result.data.text;
}

async function extractVocabColumns(file: File, langs: string): Promise<string> {
  const { blob, width, height } = await loadSizedImage(file);
  const splitX = Math.round(width * 0.48);

  let fullText = '';
  try {
    fullText = await recognizeBlob(blob, langs);
  } catch {
    /* optional */
  }

  try {
    const [leftBlob, rightBlob] = await Promise.all([
      cropBlob(blob, 0, 0, splitX, height),
      cropBlob(blob, splitX, 0, width - splitX, height),
    ]);
    const [leftText, rightText] = await Promise.all([
      recognizeBlob(leftBlob, langs),
      recognizeBlob(rightBlob, langs),
    ]);
    const merged = mergeDualColumnOcr(leftText, rightText);
    const tabLines = merged.trim().split('\n').filter((l) => l.includes('\t')).length;
    if (tabLines >= 2) {
      return fullText.trim() ? `${merged}\n\n${fullText}` : merged;
    }
  } catch {
    /* fall through */
  }

  return fullText || recognizeBlob(blob, langs);
}

export async function extractTextFromImage(
  file: File,
  sheetType: SheetType = 'vocab',
): Promise<string> {
  const langs = langsForSheetType(sheetType);
  if (sheetType === 'vocab') {
    return extractVocabColumns(file, langs);
  }
  const { blob } = await loadSizedImage(file);
  return recognizeBlob(blob, langs);
}
