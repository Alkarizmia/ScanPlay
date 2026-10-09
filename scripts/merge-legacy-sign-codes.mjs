import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'public', 'universe', 'signs');
const map = {
  F5: 'info-motorway.png',
  F19: 'info-one-way.png',
  F45: 'info-dead-end.png',
  E7: 'park-16-31.png',
  C31a: 'forbid-no-u-turn.png',
};

for (const [code, src] of Object.entries(map)) {
  const from = path.join(ROOT, src);
  const to = path.join(ROOT, `${code}.png`);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, to);
    console.log('copied', code, fs.statSync(to).size);
  } else {
    console.log('missing source', src);
  }
}

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'));
const byId = new Map(catalog.signs.map((s) => [s.id, s]));
const extras = [
  {
    id: 'E7',
    code: 'E7',
    category: 'stationnement',
    family: 'E',
    title: 'Stationnement interdit du 16 à la fin du mois',
    meaning: 'Stationnement interdit du 16 au dernier jour du mois.',
    src: '/universe/signs/E7.png',
  },
  {
    id: 'F5',
    code: 'F5',
    category: 'indication',
    family: 'F',
    title: 'Autoroute',
    meaning: 'Début d’autoroute. Max 120 km/h sauf indication.',
    src: '/universe/signs/F5.png',
  },
  {
    id: 'F19',
    code: 'F19',
    category: 'indication',
    family: 'F',
    title: 'Voie à sens unique',
    meaning: 'Sens unique. Circulation dans un seul sens.',
    src: '/universe/signs/F19.png',
  },
  {
    id: 'F45',
    code: 'F45',
    category: 'indication',
    family: 'F',
    title: 'Voie sans issue',
    meaning: 'Cul-de-sac pour véhicules.',
    src: '/universe/signs/F45.png',
  },
  {
    id: 'C31a',
    code: 'C31a',
    category: 'interdiction',
    family: 'C',
    title: 'Interdiction de demi-tour',
    meaning: 'Demi-tour interdit jusqu’au prochain carrefour inclus.',
    src: '/universe/signs/C31a.png',
  },
];
for (const e of extras) byId.set(e.id, e);

const signs = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
fs.writeFileSync(path.join(ROOT, 'catalog.json'), JSON.stringify({ size: 512, count: signs.length, signs }, null, 2));

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
