/**
 * Generates lightweight WebP variants of the mascot PNGs.
 * The full-size PNGs (400 KB - 1 MB) are far too heavy for the mobile first paint,
 * which made the SVG fallback visible for seconds on cellular connections.
 */
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const emotionsDir = join(root, 'public', 'mascot', 'emotions');

const MAX_EDGE = 420;
const QUALITY = 78;

const files = readdirSync(emotionsDir).filter((f) => f.endsWith('.png'));
if (files.length === 0) {
  console.log('No mascot PNGs found in public/mascot/emotions/');
  process.exit(0);
}

let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const pngPath = join(emotionsDir, file);
  const webpPath = pngPath.replace(/\.png$/, '.webp');

  const out = await sharp(pngPath)
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 6, alphaQuality: 90 })
    .toBuffer();

  writeFileSync(webpPath, out);

  const before = statSync(pngPath).size;
  totalBefore += before;
  totalAfter += out.length;
  console.log(
    `${file} → ${(before / 1024).toFixed(0)} KB → ${(out.length / 1024).toFixed(0)} KB webp`,
  );
}

console.log(
  `Done — ${files.length} mascot asset(s): ${(totalBefore / 1024).toFixed(0)} KB → ${(
    totalAfter / 1024
  ).toFixed(0)} KB`,
);
