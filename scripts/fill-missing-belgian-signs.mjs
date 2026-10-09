/**
 * Fetch essential F/E (and a few extras) not covered by category scrape.
 * Merges into catalog.json + regenerates drivingSignsCatalog.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.join(process.cwd(), 'public', 'universe', 'signs');
const SIZE = 512;
const UA = 'ScanPlayDrivingSigns/1.1 (educational)';

const EXTRA = [
  { code: 'E1', category: 'stationnement', family: 'E', files: ['Belgian road sign E1.svg', 'Belgian traffic sign E1.svg', 'Belgian traffic sign E1 KB-AR 03-06-2024.svg'], title: 'Stationnement interdit', meaning: 'Stationnement interdit jusqu’au prochain carrefour. L’arrêt reste autorisé.' },
  { code: 'E3', category: 'stationnement', family: 'E', files: ['Belgian road sign E3.svg', 'Belgian traffic sign E3.svg', 'Belgian traffic sign E3 KB-AR 03-06-2024.svg'], title: 'Arrêt et stationnement interdits', meaning: 'Ni arrêt ni stationnement jusqu’au prochain carrefour.' },
  { code: 'E5', category: 'stationnement', family: 'E', files: ['Belgian road sign E5.svg', 'Belgian traffic sign E5.svg'], title: 'Stationnement interdit du 1er au 15', meaning: 'Stationnement interdit du 1er au 15 du mois (au-delà du signal).' },
  { code: 'E7', category: 'stationnement', family: 'E', files: ['Belgian road sign E7.svg', 'Belgian traffic sign E7.svg'], title: 'Stationnement interdit du 16 à la fin du mois', meaning: 'Stationnement interdit du 16 au dernier jour du mois.' },
  { code: 'E9a', category: 'stationnement', family: 'E', files: ['Belgian road sign E9a.svg', 'Belgian traffic sign E9a.svg', 'Belgian traffic sign E9 KB-AR 03-06-2024.svg'], title: 'Stationnement autorisé', meaning: 'Stationnement autorisé du côté du panneau (selon règles locales).' },
  { code: 'F1', category: 'indication', family: 'F', files: ['Belgian road sign F1.svg', 'Belgian traffic sign F1.svg', 'Belgian road sign F1a.svg'], title: 'Début d’agglomération', meaning: 'Entrée en agglomération. Vitesse max 50 km/h (sauf indication).' },
  { code: 'F3', category: 'indication', family: 'F', files: ['Belgian road sign F3.svg', 'Belgian traffic sign F3.svg'], title: 'Fin d’agglomération', meaning: 'Sortie d’agglomération.' },
  { code: 'F5', category: 'indication', family: 'F', files: ['Belgian road sign F5.svg', 'Belgian traffic sign F5.svg', 'BE-F5.svg'], title: 'Autoroute', meaning: 'Début d’autoroute. Max 120 km/h sauf indication.' },
  { code: 'F7', category: 'indication', family: 'F', files: ['Belgian road sign F7.svg', 'Belgian traffic sign F7.svg'], title: 'Fin d’autoroute', meaning: 'Fin du régime autoroutier.' },
  { code: 'F9', category: 'indication', family: 'F', files: ['Belgian road sign F9.svg', 'Belgian traffic sign F9.svg'], title: 'Route pour automobiles', meaning: 'Début de route pour automobiles.' },
  { code: 'F11', category: 'indication', family: 'F', files: ['Belgian road sign F11.svg', 'Belgian traffic sign F11.svg'], title: 'Fin de route pour automobiles', meaning: 'Fin de route pour automobiles.' },
  { code: 'F13', category: 'indication', family: 'F', files: ['Belgian road sign F13.svg', 'Belgian traffic sign F13.svg'], title: 'Voie de bus', meaning: 'Voie réservée aux autobus (et usagers autorisés).' },
  { code: 'F19', category: 'indication', family: 'F', files: ['Belgian road sign F19.svg', 'Belgian traffic sign F19.svg', 'BE-F19.svg'], title: 'Voie à sens unique', meaning: 'Sens unique. Circulation dans un seul sens.' },
  { code: 'F21', category: 'indication', family: 'F', files: ['Belgian road sign F21.svg', 'Belgian traffic sign F21.svg'], title: 'Impasse', meaning: 'Voie sans issue pour véhicules.' },
  { code: 'F29', category: 'indication', family: 'F', files: ['Belgian road sign F29.svg', 'Belgian traffic sign F29.svg'], title: 'Passage pour piétons', meaning: 'Emplacement d’un passage pour piétons.' },
  { code: 'F45', category: 'indication', family: 'F', files: ['Belgian road sign F45.svg', 'Belgian traffic sign F45.svg', 'BE-F45.svg'], title: 'Voie sans issue', meaning: 'Cul-de-sac pour véhicules.' },
  { code: 'F47', category: 'indication', family: 'F', files: ['Belgian road sign F47.svg', 'Belgian traffic sign F47.svg'], title: 'Voie sans issue sauf cyclistes/piétons', meaning: 'Sans issue pour véhicules, issue possible pour cyclistes/piétons.' },
  { code: 'F49', category: 'indication', family: 'F', files: ['Belgian road sign F49.svg', 'Belgian traffic sign F49.svg'], title: 'Hôpital', meaning: 'Proximité d’un hôpital. Évite le bruit inutile.' },
  { code: 'F50', category: 'indication', family: 'F', files: ['Belgian road sign F50.svg', 'Belgian traffic sign F50.svg'], title: 'Parking', meaning: 'Indication d’un parking.' },
  { code: 'C31', category: 'interdiction', family: 'C', files: ['Belgian road sign C31.svg', 'Belgian traffic sign C31.svg', 'Belgian road sign C31a.svg'], title: 'Vitesse maximale limitée / demi-tour', meaning: 'Selon le panneau : limitation de vitesse ou interdiction de demi-tour.' },
  { code: 'C31a', category: 'interdiction', family: 'C', files: ['Belgian road sign C31a.svg', 'Belgian traffic sign C31a.svg', 'Belgian road sign C31.svg'], title: 'Interdiction de demi-tour', meaning: 'Demi-tour interdit jusqu’au prochain carrefour inclus.' },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fileUrl(fileTitle) {
  const title = fileTitle.startsWith('File:') ? fileTitle : `File:${fileTitle}`;
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

const catalogPath = path.join(ROOT, 'catalog.json');
const catalog = fs.existsSync(catalogPath)
  ? JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
  : { size: SIZE, count: 0, signs: [] };
const byId = new Map(catalog.signs.map((s) => [s.id, s]));

for (const item of EXTRA) {
  const out = path.join(ROOT, `${item.code}.png`);
  let ok = false;
  for (const file of item.files) {
    try {
      await sleep(800);
      const url = await fileUrl(file);
      await sleep(200);
      const buf = await download(url);
      await toPng(buf, out);
      byId.set(item.code, {
        id: item.code,
        code: item.code,
        category: item.category,
        family: item.family,
        title: item.title,
        meaning: item.meaning,
        src: `/universe/signs/${item.code}.png`,
      });
      console.log('ok', item.code, file, fs.statSync(out).size);
      ok = true;
      break;
    } catch (e) {
      console.log('skip', item.code, file, e.message || e);
    }
  }
  if (!ok) console.log('FAIL', item.code);
}

const signs = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
const next = { size: SIZE, count: signs.length, signs };
fs.writeFileSync(catalogPath, JSON.stringify(next, null, 2));

const tsPath = path.join(process.cwd(), 'src', 'lib', 'drivingSignsCatalog.ts');
const ts = `/**
 * Auto-generated Belgian road-sign catalog (Wikimedia SVG → 512 PNG).
 * Rebuild: node scripts/build-belgian-signs-catalog.mjs
 * Extra F/E: node scripts/fill-missing-belgian-signs.mjs
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
fs.writeFileSync(tsPath, ts);
console.log('catalog total', signs.length);
