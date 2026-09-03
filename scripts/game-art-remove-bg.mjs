/**
 * Edge flood-fill: drop white, leftover checkerboard gray, and
 * already-transparent neighbours so stickers sit on real alpha.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artDir = join(root, 'public', 'game-art');

function isBgPixel(r, g, b, a) {
  if (a < 12) return true;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const chroma = max - min;
  if (min >= 198 && chroma <= 36) return true;
  if (chroma <= 14 && min >= 110) return true;
  if (chroma <= 10 && min <= 40) return true;
  return false;
}

async function punchAlpha(filePath) {
  const { data, info } = await sharp(readFileSync(filePath))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = new Uint8Array(data);
  const w = info.width;
  const h = info.height;
  const visited = new Uint8Array(w * h);
  const queue = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (!isBgPixel(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])) return;
    visited[idx] = 1;
    queue.push([x, y]);
  };

  for (let x = 0; x < w; x += 1) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y);
    push(w - 1, y);
  }

  while (queue.length) {
    const [x, y] = queue.pop();
    pixels[(y * w + x) * 4 + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (pixels[i + 3] === 0) continue;
      const min = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
      const max = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
      if (max - min > 20 || min < 200) continue;
      const n = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      const nextToHole = n.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return true;
        return pixels[(ny * w + nx) * 4 + 3] === 0;
      });
      if (nextToHole) pixels[i + 3] = 0;
    }
  }

  const out = await sharp(Buffer.from(pixels), { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 8 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(filePath, out);

  const meta = await sharp(filePath).metadata();
  const { data: d2, info: i2 } = await sharp(filePath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  let trans = 0;
  let opaque = 0;
  for (let i = 3; i < d2.length; i += 4) {
    if (d2[i] < 10) trans += 1;
    else opaque += 1;
  }
  const pct = Math.round((100 * trans) / Math.max(trans + opaque, 1));
  const name = filePath.split(/[/\\]/).pop();
  console.log(`${name.padEnd(24)} ${String(meta.width).padStart(4)}x${String(meta.height).padEnd(4)} t%${String(pct).padStart(3)}`);
}

const files = readdirSync(artDir)
  .filter((f) => f.endsWith('.png'))
  .sort();
for (const file of files) {
  await punchAlpha(join(artDir, file));
}
