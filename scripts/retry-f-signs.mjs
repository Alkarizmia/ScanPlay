/**
 * Slow retry for remaining F-family signs after Wikimedia 429.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.join(process.cwd(), 'public', 'universe', 'signs');
const SIZE = 512;
const UA = 'ScanPlayDrivingSigns/1.1 (educational)';

const WANT = [
  { code: 'F1', files: ['Belgian road sign F1.svg', 'Belgian road sign F1a.svg', 'Belgian traffic sign F1.svg'], title: 'Début d’agglomération', meaning: 'Entrée en agglomération. Vitesse max 50 km/h (sauf indication).' },
  { code: 'F3', files: ['Belgian road sign F3.svg', 'Belgian traffic sign F3.svg'], title: 'Fin d’agglomération', meaning: 'Sortie d’agglomération.' },
  { code: 'F7', files: ['Belgian road sign F7.svg', 'Belgian traffic sign F7.svg'], title: 'Fin d’autoroute', meaning: 'Fin du régime autoroutier.' },
  { code: 'F9', files: ['Belgian road sign F9.svg', 'Belgian traffic sign F9.svg'], title: 'Route pour automobiles', meaning: 'Début de route pour automobiles.' },
  { code: 'F11', files: ['Belgian road sign F11.svg', 'Belgian traffic sign F11.svg'], title: 'Fin de route pour automobiles', meaning: 'Fin de route pour automobiles.' },
  { code: 'F13', files: ['Belgian road sign F13.svg', 'Belgian traffic sign F13.svg'], title: 'Voie de bus', meaning: 'Voie réservée aux autobus (et usagers autorisés).' },
  { code: 'F21', files: ['Belgian road sign F21.svg', 'Belgian traffic sign F21.svg'], title: 'Impasse', meaning: 'Voie sans issue pour véhicules.' },
  { code: 'F29', files: ['Belgian road sign F29.svg', 'Belgian traffic sign F29.svg'], title: 'Passage pour piétons', meaning: 'Emplacement d’un passage pour piétons.' },
  { code: 'F47', files: ['Belgian road sign F47.svg', 'Belgian traffic sign F47.svg'], title: 'Voie sans issue sauf cyclistes/piétons', meaning: 'Sans issue pour véhicules, issue possible pour cyclistes/piétons.' },
  { code: 'F49', files: ['Belgian road sign F49.svg', 'Belgian traffic sign F49.svg'], title: 'Hôpital', meaning: 'Proximité d’un hôpital. Évite le bruit inutile.' },
  { code: 'F50', files: ['Belgian road sign F50.svg', 'Belgian traffic sign F50.svg'], title: 'Parking', meaning: 'Indication d’un parking.' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fileUrl(fileTitle) {
  const title = `File:${fileTitle}`;
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json`;
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

async function toPng(svgBuf, outPath) {
  await sharp(svgBuf, { density: 420 })
    .ensureAlpha()
    .trim({ threshold: 4 })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'));
const byId = new Map(catalog.signs.map((s) => [s.id, s]));

for (const item of WANT) {
  if (fs.existsSync(path.join(ROOT, `${item.code}.png`)) && byId.has(item.code)) {
    console.log('have', item.code);
    continue;
  }
  let ok = false;
  for (const file of item.files) {
    try {
      await sleep(2500);
      const url = await fileUrl(file);
      await sleep(800);
      const buf = await download(url);
      const out = path.join(ROOT, `${item.code}.png`);
      await toPng(buf, out);
      byId.set(item.code, {
        id: item.code,
        code: item.code,
        category: 'indication',
        family: 'F',
        title: item.title,
        meaning: item.meaning,
        src: `/universe/signs/${item.code}.png`,
      });
      console.log('ok', item.code, file);
      ok = true;
      break;
    } catch (e) {
      console.log('skip', item.code, file, e.message || e);
      await sleep(4000);
    }
  }
  if (!ok) console.log('FAIL', item.code);
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
console.log('total', signs.length);
