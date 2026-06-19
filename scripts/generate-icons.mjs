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

async function writePng(dest, size) {
  mkdirSync(dirname(dest), { recursive: true });
  await sharp(source)
    .trim()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(dest);
}

await writePng(resolve(root, 'public/icon-512.png'), 512);
await writePng(resolve(root, 'public/icon-192.png'), 192);
await writePng(resolve(root, 'public/logo.png'), 512);
await writePng(resolve(root, 'public/favicon.png'), 192);
await writePng(resolve(root, 'api/assets/scanplay-checkout-icon.png'), 512);

console.log('Generated ScanPlay PNG icons from official brand logo');
