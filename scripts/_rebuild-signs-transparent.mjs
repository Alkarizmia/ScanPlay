/**
 * Rebuild 512×512 sign PNGs with transparent backgrounds.
 * PDF crops: flood-fill black matte from edges (keeps black pictograms).
 * Simple official geometries as SVG fallbacks where needed.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.join(process.cwd(), 'public', 'universe', 'signs');
const RAW = path.join(ROOT, '_raw');
const SIZE = 512;

const PDF_MAP = {
  'danger-slippery': 'p06_09.png',
  'forbid-no-u-turn': 'p05_03.png',
  'park-1-15': 'p24_02.png',
  'park-16-31': 'p24_03.png',
  'oblig-right': 'p05_12.png',
  'oblig-roundabout': 'p05_14.png',
  'info-cycle-path': 'p05_11.png',
  'danger-curve-left': 'p06_18.png',
  'danger-double-curve': 'p06_01.png',
  'danger-two-way': 'p06_19.png',
  'danger-pedestrian': 'p06_15.png',
  'danger-cyclist': 'p06_16.png',
  'danger-narrow': 'p06_06.png',
  'forbid-no-entry': 'p05_17.png',
  'forbid-no-access': 'p05_01.png',
  'priority-road': 'p17_07.png',
  'priority-end': 'p17_08.png',
  'priority-right': 'p17_06.png',
  'info-one-way': 'p05_05.png',
  'forbid-no-stopping': 'p23_02.png',
};

function isBg(r, g, b, a) {
  if (a < 8) return true;
  if (r < 28 && g < 28 && b < 28) return true;
  return false;
}

function floodClearBg(data, w, h) {
  const visited = new Uint8Array(w * h);
  const q = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (visited[i]) return;
    const o = i * 4;
    if (!isBg(data[o], data[o + 1], data[o + 2], data[o + 3])) return;
    visited[i] = 1;
    q.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  let qi = 0;
  while (qi < q.length) {
    const i = q[qi++];
    const o = i * 4;
    data[o] = 0;
    data[o + 1] = 0;
    data[o + 2] = 0;
    data[o + 3] = 0;
    const x = i % w;
    const y = (i / w) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

async function fromPdf(rawName, outPath) {
  const inputPath = path.join(RAW, rawName);
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  floodClearBg(data, info.width, info.height);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 10 })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

const SVGS = {
  'danger-children': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180">
  <polygon points="100,10 190,165 10,165" fill="#ffffff" stroke="#e30613" stroke-width="14" stroke-linejoin="round"/>
  <circle cx="78" cy="68" r="9" fill="#111111"/>
  <circle cx="120" cy="60" r="8" fill="#111111"/>
  <path d="M78 80v46M69 98h18M66 126l12-16 12 16" stroke="#111111" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M120 70v38M112 88h16M108 108l12-12 12 12" stroke="#111111" stroke-width="6" stroke-linecap="round" fill="none"/>
</svg>`,
  'priority-stop': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <polygon points="60,8 140,8 192,60 192,140 140,192 60,192 8,140 8,60" fill="#e30613" stroke="#ffffff" stroke-width="10"/>
  <text x="100" y="118" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="48" font-weight="900" fill="#ffffff">STOP</text>
</svg>`,
  'priority-give-way': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180">
  <polygon points="100,170 10,20 190,20" fill="#ffffff" stroke="#e30613" stroke-width="14" stroke-linejoin="round"/>
</svg>`,
  'forbid-no-parking': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="90" fill="#0055a4" stroke="#e30613" stroke-width="14"/>
  <line x1="42" y1="42" x2="158" y2="158" stroke="#e30613" stroke-width="18" stroke-linecap="round"/>
</svg>`,
  'info-dead-end': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="8" y="8" width="184" height="184" rx="18" fill="#0055a4"/>
  <path d="M100 42v96" stroke="#ffffff" stroke-width="22"/>
  <path d="M52 138h96" stroke="#ffffff" stroke-width="22"/>
  <rect x="70" y="40" width="60" height="30" fill="#e30613"/>
</svg>`,
  'info-motorway': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="8" y="8" width="184" height="184" rx="18" fill="#0055a4"/>
  <path d="M42 150c22-58 42-78 58-78s36 20 58 78" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
  <path d="M72 72h56" stroke="#ffffff" stroke-width="12" stroke-linecap="round"/>
  <path d="M86 56h28" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
</svg>`,
};

for (const [id, raw] of Object.entries(PDF_MAP)) {
  const out = path.join(ROOT, `${id}.png`);
  await fromPdf(raw, out);
  const m = await sharp(out).metadata();
  console.log('pdf', id, `${m.width}x${m.height}`, fs.statSync(out).size);
}

for (const [id, svg] of Object.entries(SVGS)) {
  const out = path.join(ROOT, `${id}.png`);
  await sharp(Buffer.from(svg), { density: 420 })
    .ensureAlpha()
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log('svg', id, fs.statSync(out).size);
}

console.log('done');
