/**
 * Restore critical signs missing after slug cleanup / Wikimedia 429.
 * Prefer Commons; fallback to PD-style Belgian geometries.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.join(process.cwd(), 'public', 'universe', 'signs');
const SIZE = 512;
const UA = 'ScanPlayDrivingSigns/1.1 (educational)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NEED = [
  {
    code: 'F5',
    category: 'indication',
    family: 'F',
    title: 'Autoroute',
    meaning: 'Début d’autoroute. Max 120 km/h sauf indication.',
    files: ['Belgian road sign F5.svg', 'Belgian traffic sign F5.svg', 'BE-F5.svg'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect x="8" y="8" width="184" height="184" rx="16" fill="#0055a4"/><path d="M42 150c22-58 42-78 58-78s36 20 58 78" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round"/><path d="M72 72h56" stroke="#fff" stroke-width="12" stroke-linecap="round"/><path d="M86 56h28" stroke="#fff" stroke-width="10" stroke-linecap="round"/></svg>`,
  },
  {
    code: 'F19',
    category: 'indication',
    family: 'F',
    title: 'Voie à sens unique',
    meaning: 'Sens unique. Circulation dans un seul sens.',
    files: ['Belgian road sign F19.svg', 'Belgian traffic sign F19.svg', 'BE-F19.svg'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect x="8" y="8" width="184" height="184" rx="16" fill="#0055a4"/><path d="M100 40v90" stroke="#fff" stroke-width="28" stroke-linecap="round"/><path d="M55 105l45 55 45-55" fill="#fff"/></svg>`,
  },
  {
    code: 'F45',
    category: 'indication',
    family: 'F',
    title: 'Voie sans issue',
    meaning: 'Cul-de-sac pour véhicules.',
    files: ['Belgian road sign F45.svg', 'Belgian traffic sign F45.svg', 'BE-F45.svg'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect x="8" y="8" width="184" height="184" rx="16" fill="#0055a4"/><path d="M100 42v96" stroke="#fff" stroke-width="22"/><path d="M52 138h96" stroke="#fff" stroke-width="22"/><rect x="70" y="40" width="60" height="30" fill="#e30613"/></svg>`,
  },
  {
    code: 'E7',
    category: 'stationnement',
    family: 'E',
    title: 'Stationnement interdit du 16 à la fin du mois',
    meaning: 'Stationnement interdit du 16 au dernier jour du mois.',
    files: ['Belgian road sign E7.svg', 'Belgian traffic sign E7.svg'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="90" fill="#0055a4" stroke="#e30613" stroke-width="14"/><rect x="88" y="48" width="24" height="104" transform="rotate(-45 100 100)" fill="#e30613"/><text x="100" y="168" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#fff">16-31</text></svg>`,
  },
  {
    code: 'C31a',
    category: 'interdiction',
    family: 'C',
    title: 'Interdiction de demi-tour',
    meaning: 'Demi-tour interdit jusqu’au prochain carrefour inclus.',
    files: ['Belgian road sign C31a.svg', 'Belgian traffic sign C31a.svg', 'Belgian road sign C31.svg'],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="90" fill="#fff" stroke="#e30613" stroke-width="16"/><path d="M70 130c0-40 20-60 50-60 18 0 34 8 42 22" fill="none" stroke="#111" stroke-width="14" stroke-linecap="round"/><path d="M148 72l14 28-30 4" fill="#111"/><line x1="45" y1="45" x2="155" y2="155" stroke="#e30613" stroke-width="16" stroke-linecap="round"/></svg>`,
  },
];

async function fileUrl(fileTitle) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${fileTitle}`)}&prop=imageinfo&iiprop=url&format=json`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`api ${res.status}`);
  const j = await res.json();
  const page = Object.values(j.query.pages)[0];
  if (page.missing != null || !page.imageinfo?.[0]?.url) throw new Error('missing');
  return String(page.imageinfo[0].url).split('?')[0];
}

async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`dl ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function toPng(buf, outPath, density = 420) {
  await sharp(buf, { density })
    .ensureAlpha()
    .trim({ threshold: 4 })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'));
const byId = new Map(catalog.signs.map((s) => [s.id, s]));

for (const item of NEED) {
  const out = path.join(ROOT, `${item.code}.png`);
  let source = 'fallback-svg';
  let ok = false;
  for (const file of item.files) {
    try {
      await sleep(3000);
      const url = await fileUrl(file);
      await sleep(1000);
      const buf = await download(url);
      await toPng(buf, out);
      source = file;
      ok = true;
      break;
    } catch (e) {
      console.log('skip', item.code, file, e.message || e);
      await sleep(5000);
    }
  }
  if (!ok) {
    await toPng(Buffer.from(item.svg), out, 400);
  }
  byId.set(item.code, {
    id: item.code,
    code: item.code,
    category: item.category,
    family: item.family,
    title: item.title,
    meaning: item.meaning,
    src: `/universe/signs/${item.code}.png`,
  });
  console.log(ok ? 'ok' : 'fallback', item.code, source, fs.statSync(out).size);
}

const signs = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
fs.writeFileSync(path.join(ROOT, 'catalog.json'), JSON.stringify({ size: SIZE, count: signs.length, signs }, null, 2));

const ts = `/**
 * Auto-generated Belgian road-sign catalog (Wikimedia SVG → 512 PNG).
 */
import type { DrivingSignCategory } from './drivingBelgium';

export interface DrivingCatalogSign {
  id: string;
  code: string;
  category: DrivingSignCategory;
  family: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  title: string;
  meaning: string;
  src: string;
}

export const DRIVING_SIGNS_CATALOG: DrivingCatalogSign[] = ${JSON.stringify(signs, null, 2)};

export const DRIVING_SIGN_BY_ID: Record<string, DrivingCatalogSign> = Object.fromEntries(
  DRIVING_SIGNS_CATALOG.map((s) => [s.id, s]),
);

export function drivingSignSrc(id: string): string | undefined {
  return DRIVING_SIGN_BY_ID[id]?.src;
}

export const DRIVING_FAMILY_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export function categoryForFamily(family: string): DrivingSignCategory {
  switch (family) {
    case 'A': return 'danger';
    case 'B': return 'priorite';
    case 'C': return 'interdiction';
    case 'D': return 'obligation';
    case 'E': return 'stationnement';
    default: return 'indication';
  }
}
`;
fs.writeFileSync(path.join(process.cwd(), 'src', 'lib', 'drivingSignsCatalog.ts'), ts);
const by = {};
for (const s of signs) by[s.family] = (by[s.family] || 0) + 1;
console.log(by, 'total', signs.length);
