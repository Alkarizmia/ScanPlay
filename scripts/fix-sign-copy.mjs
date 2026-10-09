/**
 * Fix Belgian sign titles/meanings to match official codes + our PNG arrow directions.
 * Sources: panneausignalisation.be, ReadyToRoad, Sécurothèque / AR 1975.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'public', 'universe', 'signs');
const catalogPath = path.join(ROOT, 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

/** code → { title, meaning } — overrides for accuracy */
const FIX = {
  // Danger A
  A8: { title: 'Chaussée glissante / gravillons', meaning: 'Risque lié à l’état de la chaussée. Adapte ton allure.' },
  A16: { title: 'Passage à niveau', meaning: 'Annonce un passage à niveau. Prépare-toi à t’arrêter.' },
  A18: { title: 'Passage à niveau sans barrières (croix)', meaning: 'Passage à niveau sans barrières. Extrême prudence.' },
  A24: { title: 'Cavaliers', meaning: 'Endroit fréquenté par des cavaliers. Adapte ton allure.' },
  A32: { title: 'Embouteillage / file', meaning: 'Risque de file. Anticipe les ralentissements.' },
  A34: { title: 'Vent latéral', meaning: 'Rafales possibles. Tiens fermement le volant.' },
  A37: { title: 'Danger (général)', meaning: 'Danger non précisé. Adapte ton allure.' },
  A45: { title: 'Passage à niveau (croix de St-André)', meaning: 'Croisement avec voie ferrée. Marquer l’arrêt si besoin.' },
  A47: { title: 'Passage à niveau à plusieurs voies', meaning: 'Plusieurs voies ferrées. Prudence accrue.' },
  A52: { title: 'Fin de toutes les interdictions temporaires', meaning: 'Fin des interdictions temporaires indiquées (selon contexte).' },
  A53: { title: 'Fin de toutes les interdictions locales', meaning: 'Fin des interdictions locales imposées aux véhicules en mouvement (selon panneau).' },

  // Priority B
  B15: { title: 'Priorité à la circulation venant en sens inverse', meaning: 'Dans le rétrécissement, cède le passage au sens inverse.' },
  B21: { title: 'Passage étroit — priorité de passage', meaning: 'Tu as priorité dans le passage étroit (selon le dispositif).' },
  B22: { title: 'Franchissement autorisé des feux', meaning: 'Autorisation de franchir la signalisation lumineuse (cas particuliers, ex. bus/tram selon panneau).' },

  // Prohibitory C — align with Belgian catalogue numbering
  C8: { title: 'Accès interdit aux véhicules tractant une remorque', meaning: 'Interdit aux véhicules avec remorque (selon panneau).' },
  C13: { title: 'Accès interdit aux véhicules attelés', meaning: 'Interdit aux conducteurs de véhicules attelés.' },
  C15: { title: 'Accès interdit aux cavaliers', meaning: 'Interdit aux cavaliers.' },
  C17: { title: 'Accès interdit aux charrettes à bras', meaning: 'Interdit aux charrettes à bras.' },
  C19: { title: 'Accès interdit aux piétons', meaning: 'Interdit aux piétons.' },
  C21: { title: 'Accès interdit — masse maximale', meaning: 'Interdit si la masse en charge dépasse celle indiquée.' },
  C22: { title: 'Accès interdit aux autocars', meaning: 'Interdit aux autocars.' },
  C23: { title: 'Accès interdit aux véhicules de transport de choses', meaning: 'Interdit aux véhicules destinés/utilisés au transport de choses.' },
  C24: { title: 'Accès interdit — marchandises dangereuses', meaning: 'Interdit aux véhicules transportant des marchandises dangereuses.' },
  C24a: { title: 'Accès interdit — marchandises dangereuses', meaning: 'Interdit aux véhicules transportant des marchandises dangereuses.' },
  C24b: { title: 'Accès interdit — matières inflammables/explosibles', meaning: 'Interdit aux transports de matières inflammables ou explosibles.' },
  C25: { title: 'Accès interdit — longueur max', meaning: 'Interdit si la longueur dépasse celle indiquée.' },
  C25a: { title: 'Accès interdit — longueur max', meaning: 'Interdit si la longueur dépasse celle indiquée.' },
  C25b: { title: 'Accès interdit — largeur max', meaning: 'Interdit si la largeur dépasse celle indiquée.' },
  C25c: { title: 'Accès interdit — hauteur max', meaning: 'Interdit si la hauteur dépasse celle indiquée.' },
  C26: { title: 'Interdiction de tourner', meaning: 'Interdiction de tourner dans la direction indiquée.' },
  C27: { title: 'Accès interdit — largeur max', meaning: 'Interdit si la largeur dépasse celle indiquée.' },
  C29: { title: 'Accès interdit — hauteur max', meaning: 'Interdit si la hauteur dépasse celle indiquée.' },
  C30: { title: 'Interdiction de dépasser', meaning: 'Dépassement interdit (selon panneau).' },
  C31: { title: 'Interdiction de tourner à gauche', meaning: 'Au prochain carrefour : interdiction de tourner à gauche.' },
  C31a: { title: 'Interdiction de tourner à gauche', meaning: 'Au prochain carrefour, interdiction de tourner à gauche.' },
  C31b: { title: 'Interdiction de tourner à droite', meaning: 'Au prochain carrefour, interdiction de tourner à droite.' },
  C32a: { title: 'Demi-tour interdit', meaning: 'Demi-tour interdit.' },
  C32b: { title: 'Demi-tour interdit (variante)', meaning: 'Demi-tour interdit.' },
  C33: { title: 'Demi-tour interdit', meaning: 'Demi-tour interdit.' },
  C35: { title: 'Dépassement interdit', meaning: 'Dépassement interdit.' },
  C37: { title: 'Fin d’interdiction de dépasser', meaning: 'Fin de l’interdiction prévue par le signal C35.' },
  C39: { title: 'Dépassement interdit (camions)', meaning: 'Dépassement interdit pour certains véhicules de transport (> 3,5 t).' },
  C41: { title: 'Fin d’interdiction de dépasser (camions)', meaning: 'Fin de l’interdiction prévue par le signal C39.' },
  C43: { title: 'Vitesse maximale limitée', meaning: 'Interdiction de dépasser la vitesse indiquée.' },
  C45: { title: 'Fin de limitation de vitesse', meaning: 'Fin de la limitation imposée par le signal C43.' },
  C46: { title: 'Fin de toutes les interdictions locales', meaning: 'Fin de toutes les interdictions locales imposées aux véhicules en mouvement.' },
  C47: { title: 'Poste de péage', meaning: 'Interdiction de passer sans s’arrêter (péage).' },

  // Obligation D — match our PNG arrows + ReadyToRoad / catalogue
  D1a: {
    title: 'Obligation d’aller tout droit',
    meaning: 'Tu dois continuer tout droit : ni à gauche ni à droite.',
  },
  D1b: {
    title: 'Obligation de tourner à droite',
    meaning: 'Au prochain carrefour, tu dois tourner à droite.',
  },
  D1c: {
    title: 'Obligation de tourner à gauche',
    meaning: 'Au prochain carrefour, tu dois tourner à gauche.',
  },
  D1d: {
    title: 'Contourner l’obstacle par la droite',
    meaning: 'Obligation de passer l’obstacle / l’îlot du côté droit (flèche).',
  },
  D1e: {
    title: 'Contourner l’obstacle par la gauche',
    meaning: 'Obligation de passer l’obstacle / l’îlot du côté gauche (flèche).',
  },
  D1f: {
    title: 'Obligation de tourner à droite',
    meaning: 'Tu dois suivre la direction à droite indiquée par la flèche.',
  },
  D1g: {
    title: 'Obligation de tourner à gauche',
    meaning: 'Tu dois suivre la direction à gauche indiquée par la flèche.',
  },
  D3a: {
    title: 'Obligation : tout droit ou à droite',
    meaning: 'Tu dois suivre une des directions indiquées (tout droit ou droite). Interdit d’aller à gauche.',
  },
  D3b: {
    title: 'Obligation : tout droit ou à gauche',
    meaning: 'Tu dois suivre une des directions indiquées (tout droit ou gauche). Interdit d’aller à droite.',
  },
  D3c: {
    title: 'Obligation : à gauche ou à droite',
    meaning: 'Tu dois suivre une des directions indiquées (gauche ou droite). Interdit d’aller tout droit.',
  },
  D4: { title: 'Chemin obligatoire pour piétons', meaning: 'Chemin réservé / obligatoire pour les piétons.' },
  D5: { title: 'Sens giratoire obligatoire', meaning: 'Rond-point : suis le sens des flèches. Clignotant obligatoire en sortant.' },
  D7: { title: 'Piste cyclable obligatoire', meaning: 'Les cyclistes doivent emprunter la piste. Autres usagers interdits sauf exceptions.' },
  D8: { title: 'Fin de piste cyclable obligatoire', meaning: 'Fin de l’obligation de piste cyclable.' },
  D9: { title: 'Voie réservée piétons et cyclistes', meaning: 'Partie de voie réservée aux piétons, bicyclettes et cyclo classe A (selon panneau).' },
  D9m: { title: 'Voie réservée piétons et cyclistes (variante)', meaning: 'Partie de voie réservée selon le panneau.' },
  D10: { title: 'Voie réservée piétons et cyclistes', meaning: 'Partie de la voie publique réservée aux piétons et cyclistes.' },
  D10m: { title: 'Fin de voie réservée', meaning: 'Fin de la réservation indiquée.' },
  D11: { title: 'Chemin obligatoire pour les piétons', meaning: 'Les piétons doivent emprunter ce chemin.' },
  D12: { title: 'Chemin obligatoire (piétons)', meaning: 'Obligation pour les piétons selon le panneau.' },
  D13: { title: 'Chemin obligatoire pour les cavaliers', meaning: 'Les cavaliers doivent emprunter ce chemin.' },
  D14: { title: 'Obligation pour usagers spécifiques', meaning: 'Obligation indiquée pour la catégorie d’usagers du panneau.' },
  D15: { title: 'Obligation pour usagers spécifiques', meaning: 'Obligation indiquée pour la catégorie d’usagers du panneau.' },
  D16: { title: 'Obligation pour usagers spécifiques', meaning: 'Obligation indiquée pour la catégorie d’usagers du panneau.' },
  D17: { title: 'Obligation pour usagers spécifiques', meaning: 'Obligation indiquée pour la catégorie d’usagers du panneau.' },
  D18: { title: 'Obligation pour usagers spécifiques', meaning: 'Obligation indiquée pour la catégorie d’usagers du panneau.' },

  // Parking E
  E9: { title: 'Stationnement autorisé / réservé', meaning: 'Stationnement autorisé ou réservé selon le panneau (disque, PMR, etc.).' },
  E9a: { title: 'Stationnement autorisé', meaning: 'Stationnement autorisé du côté du panneau (selon règles locales).' },
};

let n = 0;
for (const s of catalog.signs) {
  const fix = FIX[s.id] || FIX[s.code];
  if (!fix) continue;
  if (s.title !== fix.title || s.meaning !== fix.meaning) {
    s.title = fix.title;
    s.meaning = fix.meaning;
    n += 1;
  }
}

fs.writeFileSync(catalogPath, JSON.stringify({ ...catalog, count: catalog.signs.length, signs: catalog.signs }, null, 2));

const ts = `/**
 * Auto-generated Belgian road-sign catalog (Wikimedia SVG → 512 PNG).
 * Titles fixed via scripts/fix-sign-copy.mjs
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

export const DRIVING_SIGNS_CATALOG: DrivingCatalogSign[] = ${JSON.stringify(catalog.signs, null, 2)};

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
console.log('updated', n, 'entries; total', catalog.signs.length);
console.log('D1a', catalog.signs.find((s) => s.id === 'D1a'));
