import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.join(process.cwd(), 'public', 'universe', 'signs');
const RAW = path.join(ROOT, '_raw');
const SIZE = 512;

async function fromPdf(name, out) {
  const { data, info } = await sharp(path.join(RAW, name))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 30 && data[i + 1] < 30 && data[i + 2] < 30) data[i + 3] = 0;
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 12 })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
}

await fromPdf('p23_02.png', path.join(ROOT, 'forbid-no-stopping.png'));
console.log('forbid-no-stopping', fs.statSync(path.join(ROOT, 'forbid-no-stopping.png')).size);

/** Standard Belgian-style geometries (road signs are public domain in BE). */
const svgs = {
  'danger-children': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180">
  <polygon points="100,10 190,165 10,165" fill="#ffffff" stroke="#e30613" stroke-width="14" stroke-linejoin="round"/>
  <circle cx="78" cy="68" r="9" fill="#111111"/>
  <circle cx="120" cy="60" r="8" fill="#111111"/>
  <path d="M78 80v46M69 98h18M66 126l12-16 12 16" stroke="#111111" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M120 70v38M112 88h16M108 108l12-12 12 12" stroke="#111111" stroke-width="6" stroke-linecap="round" fill="none"/>
</svg>`,
  'info-motorway': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="8" y="8" width="184" height="184" rx="18" fill="#0055a4"/>
  <path d="M42 150c22-58 42-78 58-78s36 20 58 78" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
  <path d="M72 72h56" stroke="#ffffff" stroke-width="12" stroke-linecap="round"/>
  <path d="M86 56h28" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
</svg>`,
  'info-dead-end': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="8" y="8" width="184" height="184" rx="18" fill="#0055a4"/>
  <path d="M100 42v96" stroke="#ffffff" stroke-width="22"/>
  <path d="M52 138h96" stroke="#ffffff" stroke-width="22"/>
  <rect x="70" y="40" width="60" height="30" fill="#e30613"/>
</svg>`,
};

for (const [id, svg] of Object.entries(svgs)) {
  await sharp(Buffer.from(svg), { density: 400 })
    .ensureAlpha()
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(ROOT, `${id}.png`));
  console.log(id, fs.statSync(path.join(ROOT, `${id}.png`)).size);
}
