/**
 * Build 512×512 PNG Belgian road signs (transparent).
 * Wikimedia SVGs rendered at high density; PDF crops with black→alpha.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.join(process.cwd(), 'public', 'universe', 'signs');
const RAW = path.join(ROOT, '_raw');
const SIZE = 512;
fs.mkdirSync(ROOT, { recursive: true });

const WIKI = {
  'danger-curve-left': 'Belgian road sign A1a.svg',
  'danger-double-curve': 'Belgian road sign A1c.svg',
  'danger-two-way': 'Belgian road sign A7a.svg',
  'danger-children': 'Belgian road sign A23.svg',
  'danger-pedestrian': 'Belgian road sign A21.svg',
  'danger-cyclist': 'Belgian road sign A25.svg',
  'danger-narrow': 'Belgian road sign A5.svg',
  'forbid-no-entry': 'Belgian road sign C1.svg',
  'forbid-no-access': 'Belgian road sign C3.svg',
  'forbid-no-parking': 'Belgian road sign E1.svg',
  'forbid-no-stopping': 'Belgian road sign E3.svg',
  'priority-give-way': 'Belgian road sign B1.svg',
  'priority-stop': 'Belgian road sign B5.svg',
  'priority-road': 'Belgian road sign B9.svg',
  'priority-end': 'Belgian road sign B11.svg',
  'priority-right': 'Belgian road sign B17.svg',
  'info-one-way': 'Belgian road sign F19.svg',
  'info-dead-end': 'Belgian road sign F45.svg',
  'info-motorway': 'Belgian road sign F5.svg',
};

const PDF_ONLY = {
  'danger-slippery': 'p06_09.png',
  'forbid-no-u-turn': 'p05_03.png',
  'park-1-15': 'p24_02.png',
  'park-16-31': 'p24_03.png',
  'oblig-right': 'p05_12.png',
  'oblig-roundabout': 'p05_14.png',
  'info-cycle-path': 'p05_11.png',
};

const PDF_FALLBACK = {
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
};

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function wikiFileUrl(fileTitle) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${fileTitle}`)}&prop=imageinfo&iiprop=url&format=json`;
  const res = await fetch(api, {
    headers: { 'User-Agent': 'ScanPlayDriving/1.0 (educational; local build)' },
  });
  if (!res.ok) throw new Error(`api ${res.status}`);
  const j = await res.json();
  const page = Object.values(j.query.pages)[0];
  if (page.missing != null) throw new Error('missing on commons');
  return String(page.imageinfo[0].url).split('?')[0];
}

async function fetchBuf(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ScanPlayDriving/1.0 (educational; local build)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fromSvg(svgBuf, outPath) {
  await sharp(svgBuf, { density: 480 })
    .ensureAlpha()
    .resize(SIZE, SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function fromPdfCrop(rawName, outPath) {
  const inputPath = path.join(RAW, rawName);
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 30 && data[i + 1] < 30 && data[i + 2] < 30) data[i + 3] = 0;
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 12 })
    .resize(SIZE, SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

const report = [];

for (const [id, title] of Object.entries(WIKI)) {
  const out = path.join(ROOT, `${id}.png`);
  try {
    await sleep(1200);
    const url = await wikiFileUrl(title);
    await sleep(350);
    const buf = await fetchBuf(url);
    await fromSvg(buf, out);
    report.push({ id, ok: true, source: `wiki:${title}`, bytes: fs.statSync(out).size });
    console.log('OK', id, 'wiki', fs.statSync(out).size);
  } catch (e) {
    const fb = PDF_FALLBACK[id];
    if (fb && fs.existsSync(path.join(RAW, fb))) {
      await fromPdfCrop(fb, out);
      report.push({ id, ok: true, source: `pdf:${fb}`, bytes: fs.statSync(out).size });
      console.log('OK', id, 'pdf-fallback', fb, fs.statSync(out).size);
    } else {
      report.push({ id, ok: false, error: String(e.message || e) });
      console.log('FAIL', id, e.message || e);
    }
  }
}

for (const [id, raw] of Object.entries(PDF_ONLY)) {
  const out = path.join(ROOT, `${id}.png`);
  await fromPdfCrop(raw, out);
  report.push({ id, ok: true, source: `pdf:${raw}`, bytes: fs.statSync(out).size });
  console.log('OK', id, 'pdf', raw, fs.statSync(out).size);
}

fs.writeFileSync(path.join(ROOT, '_manifest.json'), JSON.stringify({ size: SIZE, report }, null, 2));
console.log('built', report.filter((r) => r.ok).length, '/', report.length);
