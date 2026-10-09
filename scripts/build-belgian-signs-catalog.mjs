/**
 * Download official Belgian road-sign SVGs from Wikimedia Commons
 * and build a 512×512 PNG catalog (families A–F).
 *
 * Prefer files named "A23 - Belgium.svg". Fallback: 2024 KB-AR set.
 * Run: node scripts/build-belgian-signs-catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.join(process.cwd(), 'public', 'universe', 'signs');
const SIZE = 512;
const UA = 'ScanPlayDrivingSigns/1.1 (educational; https://github.com/scanplay)';
fs.mkdirSync(ROOT, { recursive: true });

const CATEGORIES = [
  { cat: 'Category:SVG_warning_road_signs_of_Belgium', family: 'A', category: 'danger' },
  { cat: 'Category:SVG_priority_road_signs_of_Belgium', family: 'B', category: 'priorite' },
  { cat: 'Category:SVG_prohibitory_road_signs_of_Belgium', family: 'C', category: 'interdiction' },
  { cat: 'Category:SVG_mandatory_road_signs_of_Belgium', family: 'D', category: 'obligation' },
  { cat: 'Category:SVG_parking_road_signs_of_Belgium', family: 'E', category: 'stationnement' },
  { cat: 'Category:SVG_information_road_signs_of_Belgium', family: 'F', category: 'indication' },
];

/** Official-ish FR titles for Belgian theory (code → { title, meaning }). */
const COPY = {
  A1a: { title: 'Virage dangereux à gauche', meaning: 'Danger à environ 150 m (sauf panneau additionnel). Adapte ton allure.' },
  A1b: { title: 'Virage dangereux à droite', meaning: 'Danger à environ 150 m. Adapte ton allure avant le virage.' },
  A1c: { title: 'Double virage, premier à gauche', meaning: 'Suite de virages. Le premier est à gauche.' },
  A1d: { title: 'Double virage, premier à droite', meaning: 'Suite de virages. Le premier est à droite.' },
  A3: { title: 'Descente dangereuse', meaning: 'Pente forte. Contrôle ta vitesse, utilise le frein moteur si besoin.' },
  A5: { title: 'Rétrécissement de chaussée', meaning: 'La chaussée se rétrécit. Anticipe et cède si nécessaire.' },
  A7a: { title: 'Circulation dans les deux sens', meaning: 'Tu quittes un sens unique : attention au sens inverse.' },
  A7b: { title: 'Chaussée glissante', meaning: 'Risque de glissade. Réduis la vitesse, évite les freinages brusques.' },
  A7c: { title: 'Projection de gravillons', meaning: 'Risque de projections. Augmente les distances.' },
  A9: { title: 'Chaussée déformée', meaning: 'Irrégularités de la chaussée. Adapte ton allure.' },
  A11: { title: 'Dos d’âne', meaning: 'Ralentisseur / dos d’âne. Réduis fortement ta vitesse.' },
  A13: { title: 'Éboulement', meaning: 'Risque de chutes de pierres. Reste vigilant.' },
  A14: { title: 'Chaussée glissante (verglas/pluie)', meaning: 'Risque de glissade lié aux conditions. Adapte ton allure.' },
  A15: { title: 'Passage à niveau avec barrières', meaning: 'Passage à niveau avec barrières. Prépare-toi à t’arrêter.' },
  A17: { title: 'Passage à niveau sans barrières', meaning: 'Passage à niveau sans barrières. Extrême prudence.' },
  A19: { title: 'Tramway', meaning: 'Traversée ou présence de tram. Respecte les priorités.' },
  A21: { title: 'Passage pour piétons', meaning: 'Annonce un passage piétons. Sois prêt à céder le passage.' },
  A23: { title: 'Endroit fréquenté par des enfants', meaning: 'Adapte ton allure si des enfants sont présents (pas de limite chiffrée auto).' },
  A25: { title: 'Passage pour cyclistes', meaning: 'Annonce un passage pour cyclistes. Prudence accrue.' },
  A27: { title: 'Animaux', meaning: 'Risque de traverse d’animaux. Adapte ton allure.' },
  A31: { title: 'Travaux', meaning: 'Zone de travaux. Respecte la signalisation temporaire.' },
  A33: { title: 'Feux de signalisation', meaning: 'Annonce des feux. Prépare-toi à t’arrêter.' },
  A35: { title: 'File / embouteillage', meaning: 'Risque de file. Anticipe les ralentissements.' },
  A39: { title: 'Vent latéral', meaning: 'Rafales possibles. Tiens fermement le volant.' },
  A41: { title: 'Danger (général)', meaning: 'Danger non précisé. Adapte ton allure et reste vigilant.' },
  A43: { title: 'Accident', meaning: 'Zone d’accident. Ralentis et facilite les secours.' },
  A49: { title: 'Tunnel', meaning: 'Entrée de tunnel. Allume les feux, respecte les règles spécifiques.' },
  A51: { title: 'Passage d’avion à basse altitude', meaning: 'Proximité d’aéroport. Attention aux distractions.' },
  A53: { title: 'Fin de toutes les interdictions locales', meaning: 'Fin des interdictions temporaires indiquées (selon contexte).' },

  B1: { title: 'Céder le passage', meaning: 'Tu dois céder le passage avant de t’engager.' },
  B3: { title: 'Céder le passage à droite', meaning: 'Cède le passage aux usagers venant de droite (selon implant).' },
  B5: { title: 'Stop', meaning: 'Arrêt complet obligatoire, puis céder le passage.' },
  B9: { title: 'Voie prioritaire', meaning: 'Tu circules sur une voie prioritaire.' },
  B11: { title: 'Fin de voie prioritaire', meaning: 'Fin du régime prioritaire. Retour aux règles normales.' },
  B13: { title: 'Priorité par rapport à la circulation venant en sens inverse', meaning: 'Tu as priorité sur le sens inverse dans le rétrécissement.' },
  B15: { title: 'Priorité à la circulation venant en sens inverse', meaning: 'Tu dois céder au sens inverse dans le rétrécissement.' },
  B17: { title: 'Carrefour à priorité de droite', meaning: 'Annonce un carrefour où s’applique la priorité de droite.' },
  B19: { title: 'Priorité de passage', meaning: 'Tu as priorité de passage (selon le dispositif).' },
  B21: { title: 'Fin de priorité de passage', meaning: 'Fin du régime de priorité de passage.' },

  C1: { title: 'Sens interdit', meaning: 'Interdit à tout conducteur dans ce sens. Effet immédiat.' },
  C3: { title: 'Accès interdit', meaning: 'Accès interdit dans les deux sens à tout conducteur.' },
  C5: { title: 'Accès interdit aux véhicules à moteur', meaning: 'Interdit aux véhicules à moteur (sauf exceptions indiquées).' },
  C6: { title: 'Accès interdit aux motocycles', meaning: 'Interdit aux motocycles.' },
  C7: { title: 'Accès interdit aux cyclomoteurs', meaning: 'Interdit aux cyclomoteurs.' },
  C9: { title: 'Accès interdit aux cyclistes', meaning: 'Interdit aux cyclistes.' },
  C11: { title: 'Accès interdit aux véhicules agricoles', meaning: 'Interdit aux véhicules agricoles.' },
  C13: { title: 'Accès interdit aux véhicules de plus de … tonnes', meaning: 'Interdiction liée au poids. Respecte la limite indiquée.' },
  C17: { title: 'Accès interdit aux véhicules de plus de … m de large', meaning: 'Interdiction liée à la largeur.' },
  C19: { title: 'Accès interdit aux véhicules de plus de … m de haut', meaning: 'Interdiction liée à la hauteur.' },
  C21: { title: 'Accès interdit aux véhicules transportant des marchandises dangereuses', meaning: 'Interdit aux transports de matières dangereuses.' },
  C22: { title: 'Accès interdit aux véhicules transportant des explosifs', meaning: 'Interdit aux transports d’explosifs.' },
  C23: { title: 'Accès interdit aux véhicules transportant des produits polluants pour l’eau', meaning: 'Interdit aux transports polluants pour l’eau.' },
  C24a: { title: 'Interdiction de tourner à gauche', meaning: 'Interdit de tourner à gauche au prochain carrefour.' },
  C24b: { title: 'Interdiction de tourner à droite', meaning: 'Interdit de tourner à droite au prochain carrefour.' },
  C25: { title: 'Interdiction de faire demi-tour', meaning: 'Demi-tour interdit jusqu’au prochain carrefour inclus.' },
  C27: { title: 'Interdiction de dépasser', meaning: 'Dépassement interdit pour les véhicules à moteur (sauf exceptions).' },
  C29: { title: 'Interdiction de dépasser pour les camions', meaning: 'Dépassement interdit aux camions.' },
  C31: { title: 'Vitesse maximale limitée', meaning: 'Vitesse max indiquée jusqu’à un signal de fin ou un autre régime.' },
  C31a: { title: 'Interdiction de demi-tour', meaning: 'Demi-tour interdit jusqu’au prochain carrefour inclus.' },
  C33: { title: 'Fin de limitation de vitesse', meaning: 'Fin de la limitation de vitesse précédente.' },
  C35: { title: 'Fin d’interdiction de dépasser', meaning: 'Fin de l’interdiction de dépasser.' },
  C37: { title: 'Fin de toutes les interdictions imposées aux véhicules en mouvement', meaning: 'Fin des interdictions de mouvement (vitesse, dépassement…).' },
  C39: { title: 'Interdiction d’user d’avertisseur sonore', meaning: 'Klaxon interdit (sauf danger).' },
  C43: { title: 'Interdiction aux véhicules tractant une remorque', meaning: 'Interdit aux ensembles avec remorque (selon panneau).' },
  C45: { title: 'Interdiction de stationner et d’arrêter pour faire le plein', meaning: 'Zone où l’arrêt/stationnement lié au plein est interdit (selon implant).' },
  C46: { title: 'Zone 30', meaning: 'Début de zone 30 km/h.' },
  C47: { title: 'Fin de zone 30', meaning: 'Fin de zone 30 km/h.' },
  C49: { title: 'Zone de rencontre', meaning: 'Zone de rencontre : priorité aux usagers vulnérables, max 20 km/h.' },
  C50: { title: 'Fin de zone de rencontre', meaning: 'Fin de zone de rencontre.' },

  D1a: { title: 'Obligation d’aller tout droit', meaning: 'Tu dois continuer tout droit : ni à gauche ni à droite.' },
  D1b: { title: 'Obligation de tourner à droite', meaning: 'Au prochain carrefour, tu dois tourner à droite.' },
  D1c: { title: 'Obligation de tourner à gauche', meaning: 'Au prochain carrefour, tu dois tourner à gauche.' },
  D1d: { title: 'Contourner l’obstacle par la droite', meaning: 'Obligation de passer l’obstacle du côté droit.' },
  D1e: { title: 'Contourner l’obstacle par la gauche', meaning: 'Obligation de passer l’obstacle du côté gauche.' },
  D1f: { title: 'Obligation de tourner à droite', meaning: 'Tu dois suivre la direction à droite indiquée par la flèche.' },
  D1g: { title: 'Obligation de tourner à gauche', meaning: 'Tu dois suivre la direction à gauche indiquée par la flèche.' },
  D3a: { title: 'Obligation : tout droit ou à droite', meaning: 'Une des directions indiquées (tout droit ou droite).' },
  D3b: { title: 'Obligation : tout droit ou à gauche', meaning: 'Une des directions indiquées (tout droit ou gauche).' },
  D3c: { title: 'Obligation : à gauche ou à droite', meaning: 'Une des directions indiquées (gauche ou droite).' },
  D4: { title: 'Chemin obligatoire pour piétons', meaning: 'Chemin réservé / obligatoire pour piétons selon le panneau.' },
  D5: { title: 'Sens giratoire obligatoire', meaning: 'Rond-point : suis le sens des flèches. Clignotant en sortant.' },
  D7: { title: 'Piste cyclable obligatoire', meaning: 'Les cyclistes doivent emprunter la piste. Autres usagers : interdits sauf exceptions.' },
  D9: { title: 'Voie réservée piétons et cyclistes', meaning: 'Voie partagée obligatoire selon le panneau.' },
  D10: { title: 'Voie réservée piétons et cyclistes', meaning: 'Partie de voie réservée aux piétons et cyclistes.' },
  D11: { title: 'Chemin obligatoire pour les piétons', meaning: 'Les piétons doivent emprunter ce chemin.' },
  C31a: { title: 'Interdiction de tourner à gauche', meaning: 'Au prochain carrefour, interdiction de tourner à gauche.' },
  C33: { title: 'Demi-tour interdit', meaning: 'Demi-tour interdit.' },
  C35: { title: 'Dépassement interdit', meaning: 'Dépassement interdit.' },
  C43: { title: 'Vitesse maximale limitée', meaning: 'Interdiction de dépasser la vitesse indiquée.' },

  E1: { title: 'Stationnement interdit', meaning: 'Stationnement interdit jusqu’au prochain carrefour. L’arrêt reste autorisé.' },
  E3: { title: 'Arrêt et stationnement interdits', meaning: 'Ni arrêt ni stationnement jusqu’au prochain carrefour.' },
  E5: { title: 'Stationnement interdit du 1er au 15', meaning: 'Stationnement interdit du 1er au 15 du mois (au-delà du signal).' },
  E7: { title: 'Stationnement interdit du 16 à la fin du mois', meaning: 'Stationnement interdit du 16 au dernier jour du mois.' },
  E9a: { title: 'Stationnement autorisé', meaning: 'Stationnement autorisé du côté du panneau (selon règles locales).' },
  E9b: { title: 'Stationnement réservé', meaning: 'Emplacement réservé (catégorie indiquée sur le panneau).' },
  E11: { title: 'Parking', meaning: 'Aire / parking (indication de stationnement).' },
  E23: { title: 'Arrêt de bus', meaning: 'Arrêt d’autobus. Règles spécifiques d’arrêt/stationnement.' },

  F1: { title: 'Début d’agglomération', meaning: 'Entrée en agglomération. Vitesse max 50 km/h (sauf indication).' },
  F1a: { title: 'Début d’agglomération', meaning: 'Entrée en agglomération. Vitesse max 50 km/h (sauf indication).' },
  F3: { title: 'Fin d’agglomération', meaning: 'Sortie d’agglomération. Autres limitations s’appliquent.' },
  F3a: { title: 'Fin d’agglomération', meaning: 'Sortie d’agglomération.' },
  F5: { title: 'Autoroute', meaning: 'Début d’autoroute. Max 120 km/h sauf indication.' },
  F7: { title: 'Fin d’autoroute', meaning: 'Fin du régime autoroutier.' },
  F9: { title: 'Route pour automobiles', meaning: 'Début de route pour automobiles.' },
  F11: { title: 'Fin de route pour automobiles', meaning: 'Fin de route pour automobiles.' },
  F13: { title: 'Voie de bus', meaning: 'Voie réservée aux autobus (et usagers autorisés).' },
  F19: { title: 'Voie à sens unique', meaning: 'Sens unique. Circulation dans un seul sens.' },
  F21: { title: 'Impasse pour véhicules', meaning: 'Cul-de-sac / voie sans issue pour véhicules.' },
  F29: { title: 'Passage pour piétons', meaning: 'Emplacement d’un passage pour piétons.' },
  F33: { title: 'Directions (préavis)', meaning: 'Panneau de direction / préavis de direction.' },
  F34: { title: 'Directions', meaning: 'Panneau de direction.' },
  F41: { title: 'Impasse', meaning: 'Voie sans issue.' },
  F45: { title: 'Voie sans issue', meaning: 'Cul-de-sac pour véhicules (piétons/cyclistes souvent possibles).' },
  F47: { title: 'Voie sans issue sauf cyclistes/piétons', meaning: 'Sans issue pour véhicules, issue pour cyclistes/piétons.' },
  F49: { title: 'Hôpital', meaning: 'Proximité d’un hôpital. Évite le bruit inutile.' },
  F50: { title: 'Parking', meaning: 'Indication d’un parking.' },
  F51: { title: 'Poste de secours', meaning: 'Poste de secours / premiers soins.' },
  F53: { title: 'Téléphone', meaning: 'Téléphone d’urgence / public.' },
  F55: { title: 'Poste d’essence', meaning: 'Station-service.' },
  F57: { title: 'Hôtel / restaurant', meaning: 'Services hôteliers / restauration.' },
  F59: { title: 'Camping', meaning: 'Terrain de camping.' },
  F61: { title: 'Auberge de jeunesse', meaning: 'Auberge de jeunesse.' },
  F63: { title: 'Informations touristiques', meaning: 'Point d’information touristique.' },
  F65: { title: 'Atelier de réparation', meaning: 'Garage / atelier.' },
  F67: { title: 'Extincteur', meaning: 'Présence d’un extincteur.' },
  F69: { title: 'WC', meaning: 'Toilettes publiques.' },
  F91: { title: 'Nombre de voies', meaning: 'Indication du nombre de voies / réduction de voies.' },
  F99a: { title: 'Début de zone de stationnement à durée limitée', meaning: 'Zone de stationnement réglementée (disque / horodateur selon panneau).' },
  F99b: { title: 'Fin de zone de stationnement à durée limitée', meaning: 'Fin de la zone de stationnement réglementée.' },
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeCode(raw) {
  const letter = raw.charAt(0).toUpperCase();
  const rest = raw.slice(1);
  // Keep trailing letter lowercase (A1a, C24b…)
  const m = rest.match(/^(\d+)([a-zA-Z]?)$/);
  if (!m) return letter + rest;
  return letter + m[1] + (m[2] ? m[2].toLowerCase() : '');
}

function parseCodeFromTitle(title) {
  const t = title.replace(/^File:/, '');
  let m = t.match(/^([A-F]\d+[a-zA-Z]?)\s*-\s*Belgium\.svg$/i);
  if (m) return normalizeCode(m[1]);
  m = t.match(/Belgian traffic sign ([A-F]\d+[a-zA-Z]?)(?:\s|$)/i);
  if (m) return normalizeCode(m[1]);
  m = t.match(/Belgian road sign ([A-F]\d+[a-zA-Z]?)\.svg$/i);
  if (m) return normalizeCode(m[1]);
  return null;
}

function preferScore(title) {
  const t = title.replace(/^File:/, '');
  if (/^[A-F][0-9]+[a-zA-Z]?\s*-\s*Belgium\.svg$/i.test(t)) return 3;
  if (/^Belgian road sign [A-F][0-9]+[a-zA-Z]?\.svg$/i.test(t)) return 2;
  if (/Belgian traffic sign [A-F][0-9]+[a-zA-Z]?/i.test(t) && /KB-AR/i.test(t)) return 1;
  return 0;
}
async function listCategory(cmtitle) {
  const files = [];
  let cmcontinue;
  do {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'categorymembers');
    url.searchParams.set('cmtitle', cmtitle);
    url.searchParams.set('cmtype', 'file');
    url.searchParams.set('cmlimit', '500');
    url.searchParams.set('format', 'json');
    if (cmcontinue) url.searchParams.set('cmcontinue', cmcontinue);
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`list ${cmtitle} ${res.status}`);
    const j = await res.json();
    files.push(...(j.query?.categorymembers ?? []));
    cmcontinue = j.continue?.cmcontinue;
    await sleep(400);
  } while (cmcontinue);
  return files;
}

async function fileUrl(fileTitle) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url&format=json`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`api ${res.status}`);
  const j = await res.json();
  const page = Object.values(j.query.pages)[0];
  if (page.missing != null) throw new Error('missing');
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

function defaultCopy(code, category) {
  const known = COPY[code] || COPY[code.toUpperCase()] || COPY[code.replace(/([A-Z])/, (m) => m)];
  if (known) return known;
  // try case variants
  const keys = Object.keys(COPY);
  const hit = keys.find((k) => k.toLowerCase() === code.toLowerCase());
  if (hit) return COPY[hit];
  return {
    title: `Panneau ${code}`,
    meaning: `Signalisation belge (${category}). Consulte le catalogue officiel pour le détail.`,
  };
}

const picked = new Map(); // code -> { title: fileTitle, score, family, category }

for (const { cat, family, category } of CATEGORIES) {
  console.log('list', cat);
  const members = await listCategory(cat);
  for (const m of members) {
    const code = parseCodeFromTitle(m.title);
    if (!code) continue;
    if (code[0] !== family) continue;
    const score = preferScore(m.title);
    if (score === 0) continue;
    const prev = picked.get(code);
    if (!prev || score > prev.score) {
      picked.set(code, { fileTitle: m.title, score, family, category, code });
    }
  }
}

console.log('unique codes', picked.size);

const catalog = [];
const report = [];

for (const [code, meta] of [...picked.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }))) {
  const out = path.join(ROOT, `${code}.png`);
  const copy = defaultCopy(code, meta.category);
  try {
    if (!fs.existsSync(out) || fs.statSync(out).size < 800) {
      await sleep(900);
      const url = await fileUrl(meta.fileTitle);
      await sleep(250);
      const buf = await download(url);
      await toPng(buf, out);
    }
    const bytes = fs.statSync(out).size;
    catalog.push({
      id: code,
      code,
      category: meta.category,
      family: meta.family,
      title: copy.title,
      meaning: copy.meaning,
      src: `/universe/signs/${code}.png`,
    });
    report.push({ code, ok: true, bytes, source: meta.fileTitle });
    console.log('ok', code, bytes);
  } catch (e) {
    report.push({ code, ok: false, error: String(e.message || e), source: meta.fileTitle });
    console.log('fail', code, e.message || e);
  }
}

fs.writeFileSync(path.join(ROOT, 'catalog.json'), JSON.stringify({ size: SIZE, count: catalog.length, signs: catalog }, null, 2));
fs.writeFileSync(path.join(ROOT, '_build-report.json'), JSON.stringify(report, null, 2));

// Generate TypeScript catalog module
const tsPath = path.join(process.cwd(), 'src', 'lib', 'drivingSignsCatalog.ts');
const ts = `/**
 * Auto-generated Belgian road-sign catalog (Wikimedia SVG → 512 PNG).
 * Rebuild: node scripts/build-belgian-signs-catalog.mjs
 */
import type { DrivingSign, DrivingSignCategory } from './drivingBelgium';

export interface DrivingCatalogSign extends DrivingSign {
  code: string;
  family: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  src: string;
}

export const DRIVING_SIGNS_CATALOG: DrivingCatalogSign[] = ${JSON.stringify(catalog, null, 2).replace(/"category": "/g, '"category": "')};

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
console.log('wrote', catalog.length, 'signs → catalog.json + drivingSignsCatalog.ts');
