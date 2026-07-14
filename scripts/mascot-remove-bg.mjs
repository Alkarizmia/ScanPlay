/**
 * Removes edge-connected white/near-white background from mascot PNGs.
 * Preserves interior whites (play button, eye highlights).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const emotionsDir = join(root, 'public', 'mascot', 'emotions');

const THRESHOLD = 232;
const SOFT_THRESHOLD = 210;
const HOLE_THRESHOLD = 208;

function isBackgroundPixel(r, g, b) {
  return r >= THRESHOLD && g >= THRESHOLD && b >= THRESHOLD;
}

function isSoftEdgePixel(r, g, b) {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= SOFT_THRESHOLD && max - min <= 18;
}

function isNearWhitePixel(r, g, b, a) {
  if (a < 128) return false;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= HOLE_THRESHOLD && max - min <= 28;
}

function getContentBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  return { minX, minY, maxX, maxY };
}

function shouldRemoveWhiteHole(component, content) {
  const { count, minX, maxX, minY, maxY } = component;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const ratio = bw / Math.max(bh, 1);
  const cy = (minY + maxY) / 2;
  const contentH = Math.max(content.maxY - content.minY, 1);
  const relY = (cy - content.minY) / contentH;

  // Keep tiny highlights (eye glints, etc.)
  if (count < 120) return false;

  // Lower body (legs/feet): remove all interior white pockets
  if (relY > 0.68) return true;

  // Keep compact regions in upper body (play button, eye whites)
  const compact = ratio >= 0.65 && ratio <= 1.55;
  if (compact && relY < 0.74) return false;

  // Leg gap / interior background: wide horizontal strip
  if (ratio > 2 && count > 400) return true;

  return false;
}

function removeInteriorWhiteHoles(data, width, height) {
  const content = getContentBounds(data, width, height);
  if (content.maxX <= content.minX) return;

  const visited = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (visited[idx]) continue;

      const i = idx * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (!isNearWhitePixel(r, g, b, a)) continue;

      const pixels = [];
      const queue = [[x, y]];
      visited[idx] = 1;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (queue.length > 0) {
        const [cx, cy] = queue.pop();
        pixels.push([cx, cy]);
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (visited[nIdx]) continue;
          const ni = nIdx * 4;
          if (!isNearWhitePixel(data[ni], data[ni + 1], data[ni + 2], data[ni + 3])) continue;
          visited[nIdx] = 1;
          queue.push([nx, ny]);
        }
      }

      const component = { count: pixels.length, minX, maxX, minY, maxY };
      if (!shouldRemoveWhiteHole(component, content)) continue;

      for (const [px, py] of pixels) {
        const pi = (py * width + px) * 4;
        data[pi + 3] = 0;
      }
    }
  }
}

function removeEdgeBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  const tryPush = (x, y, softOnly = false) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const match = softOnly ? isSoftEdgePixel(r, g, b) : isBackgroundPixel(r, g, b);
    if (!match) return;
    visited[idx] = 1;
    queue.push([x, y]);
  };

  for (let x = 0; x < width; x += 1) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (queue.length > 0) {
    const [x, y] = queue.pop();
    const i = (y * width + x) * 4;
    data[i + 3] = 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  // Soften remaining light fringe adjacent to transparency
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const i = idx * 4;
      if (data[i + 3] === 0) continue;
      const neighbors = [
        data[((y - 1) * width + x) * 4 + 3],
        data[((y + 1) * width + x) * 4 + 3],
        data[(y * width + (x - 1)) * 4 + 3],
        data[(y * width + (x + 1)) * 4 + 3],
      ];
      if (!neighbors.some((a) => a === 0)) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isSoftEdgePixel(r, g, b)) {
        const lum = (r + g + b) / 3;
        const fade = Math.max(0, Math.min(1, (lum - SOFT_THRESHOLD) / (THRESHOLD - SOFT_THRESHOLD)));
        data[i + 3] = Math.round(data[i + 3] * (1 - fade * 0.85));
      }
    }
  }
}

async function processFile(filePath) {
  const input = readFileSync(filePath);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8Array(data);
  removeEdgeBackground(pixels, info.width, info.height);
  removeInteriorWhiteHoles(pixels, info.width, info.height);
  const out = await sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 1 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  writeFileSync(filePath, out);
  return filePath;
}

const files = readdirSync(emotionsDir).filter((f) => f.endsWith('.png'));
if (files.length === 0) {
  console.log('No mascot PNGs found in public/mascot/emotions/');
  process.exit(0);
}

for (const file of files) {
  const path = join(emotionsDir, file);
  await processFile(path);
  console.log(`Transparent BG: ${file}`);
}

console.log(`Done — ${files.length} mascot asset(s) processed.`);
