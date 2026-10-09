/**
 * Download official Belgian road-sign SVGs (public domain) from Wikimedia
 * and normalize to 512×512 PNG for the Univers driving module.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.join(process.cwd(), 'public', 'universe', 'signs');
fs.mkdirSync(OUT, { recursive: true });

/** Our id → Wikimedia file title (without File:) */
const MAP = {
  'danger-curve-left': 'Belgian road sign A1a.svg',
  'danger-double-curve': 'Belgian road sign A1c.svg',
  'danger-two-way': 'Belgian road sign A7a.svg',
  'danger-slippery': 'Belgian road sign A7b.svg',
  'danger-children': 'Belgian road sign A23.svg',
  'danger-pedestrian': 'Belgian road sign A21.svg',
  'danger-cyclist': 'Belgian road sign A25.svg',
  'danger-narrow': 'Belgian road sign A5.svg',
  'forbid-no-entry': 'Belgian road sign C1.svg',
  'forbid-no-access': 'Belgian road sign C3.svg',
  'forbid-no-u-turn': 'Belgian road sign C31a.svg',
  'forbid-no-parking': 'Belgian road sign E1.svg',
  'forbid-no-stopping': 'Belgian road sign E3.svg',
  'park-1-15': 'Belgian road sign E5.svg',
  'park-16-31': 'Belgian road sign E7.svg',
  'priority-give-way': 'Belgian road sign B1.svg',
  'priority-stop': 'Belgian road sign B5.svg',
  'priority-road': 'Belgian road sign B9.svg',
  'priority-end': 'Belgian road sign B11.svg',
  'priority-right': 'Belgian road sign B17.svg',
  'oblig-right': 'Belgian road sign D1.svg',
  'oblig-roundabout': 'Belgian road sign D5.svg',
  'info-one-way': 'Belgian road sign F19.svg',
  'info-dead-end': 'Belgian road sign F45.svg',
  'info-cycle-path': 'Belgian road sign D7.svg',
  'info-motorway': 'Belgian road sign F5.svg',
};

const SIZE = 512;

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ScanPlayDrivingSigns/1.0 (educational; local build)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function normalizeToPng(inputBuf, outPath) {
  // Trim near-white/transparent edges then fit in square canvas
  const trimmed = await sharp(inputBuf)
    .ensureAlpha()
    .trim({ threshold: 8 })
    .png()
    .toBuffer();

  const meta = await sharp(trimmed).metadata();
  const w = meta.width ?? SIZE;
  const h = meta.height ?? SIZE;
  const side = Math.max(w, h);
  const padX = Math.floor((side - w) / 2);
  const padY = Math.floor((side - h) / 2);

  await sharp({
    create: {
      width: side,
      height: side,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: trimmed, left: padX, top: padY }])
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

const results = [];
for (const [id, file] of Object.entries(MAP)) {
  const encoded = encodeURIComponent(file);
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}`;
  try {
    const buf = await fetchBuffer(url);
    const out = path.join(OUT, `${id}.png`);
    await normalizeToPng(buf, out);
    const st = fs.statSync(out);
    results.push({ id, ok: true, bytes: st.size, file });
    console.log('OK', id, st.size);
  } catch (e) {
    results.push({ id, ok: false, error: String(e.message || e), file });
    console.log('FAIL', id, e.message || e);
  }
}

fs.writeFileSync(path.join(OUT, '_manifest.json'), JSON.stringify({ size: SIZE, results }, null, 2));
console.log('done', results.filter((r) => r.ok).length, '/', results.length);
