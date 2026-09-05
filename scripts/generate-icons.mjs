import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const master = resolve(root, 'public/brand/scanplay-logo.png');

if (!existsSync(master)) {
  console.error('Missing official logo: public/brand/scanplay-logo.png');
  process.exit(1);
}

const source = readFileSync(master);
const GREEN = { r: 88, g: 204, b: 2, alpha: 1 };

async function writePng(dest, size) {
  mkdirSync(dirname(dest), { recursive: true });
  await sharp(source)
    .trim()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(dest);
}

/** Icônes launcher PWA : fond vert plein, glyphe plus grand et centré (safe zone maskable). */
async function writePwaIcon(dest, size, glyphRatio) {
  mkdirSync(dirname(dest), { recursive: true });
  const glyphSize = Math.round(size * glyphRatio);
  const glyph = await sharp(source)
    .trim()
    .resize(glyphSize, glyphSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const inset = Math.round((size - glyphSize) / 2);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: GREEN,
    },
  })
    .composite([{ input: glyph, top: inset, left: inset }])
    .png()
    .toFile(dest);
}

await writePng(resolve(root, 'public/logo.png'), 512);
await writePng(resolve(root, 'public/favicon.png'), 192);
await writePng(resolve(root, 'api/assets/scanplay-checkout-icon.png'), 512);

await writePwaIcon(resolve(root, 'public/icon-192.png'), 192, 0.82);
await writePwaIcon(resolve(root, 'public/icon-512.png'), 512, 0.82);
await writePwaIcon(resolve(root, 'public/icon-maskable-512.png'), 512, 0.66);

console.log('Generated ScanPlay PNG icons from official brand logo');
