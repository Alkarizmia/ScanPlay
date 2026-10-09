/**
 * Belgian driving-theory content (official A–F sign catalog + MCQ).
 * Sign assets: Wikimedia SVG → public/universe/signs/{code}.png
 */

import { DRIVING_SIGNS_CATALOG } from './drivingSignsCatalog';
import { resolveDrivingSignId } from './drivingSignAliases';

export type DrivingSignCategory =
  | 'danger'
  | 'interdiction'
  | 'obligation'
  | 'priorite'
  | 'indication'
  | 'stationnement';

export interface DrivingSign {
  id: string;
  category: DrivingSignCategory;
  /** Short title shown in learn mode. */
  title: string;
  /** What the sign means / when it applies. */
  meaning: string;
  /** Official family letter when from catalog. */
  family?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  code?: string;
}

export interface DrivingQuestion {
  id: string;
  prompt: string;
  choices: [string, string, string];
  /** 0 | 1 | 2 */
  correct: 0 | 1 | 2;
  /** Official code or legacy slug. */
  signId?: string;
  topic: string;
}

export const DRIVING_EXAM_SIZE = 30;
export const DRIVING_EXAM_MAX_WRONG = 5;
export const DRIVING_EXERCISE_SIZE = 10;

/** Full illustrated catalog (typically 100+ official Belgian signs). */
export const DRIVING_SIGNS: DrivingSign[] = DRIVING_SIGNS_CATALOG.map((s) => ({
  id: s.id,
  category: s.category,
  title: s.title,
  meaning: s.meaning,
  family: s.family,
  code: s.code,
}));

export const DRIVING_QUESTIONS: DrivingQuestion[] = [
  {
    id: 'q-piste-cyclable',
    prompt: 'Qu’est-ce qu’une piste cyclable ?',
    choices: [
      'Une bande de la chaussée réservée aux cyclistes et cyclo de classe A, marquée d’un pictogramme vélo',
      'Une partie de la voie publique isolée de la chaussée et délimitée, prioritaire et réservée aux cyclistes et cyclo de classe A',
      'Une partie du trottoir réservée aux cyclistes et cyclo de classe A',
    ],
    correct: 1,
    signId: 'D7',
    topic: 'usagers',
  },
  {
    id: 'q-park-1-15',
    prompt: 'Au-delà de ce signal :',
    choices: [
      'Le stationnement est interdit du 1er au 15 du mois',
      'Le stationnement est interdit du 16 au 31 du mois',
      'Le stationnement est autorisé sauf indication contraire',
    ],
    correct: 0,
    signId: 'E5',
    topic: 'stationnement',
  },
  {
    id: 'q-park-16-31',
    prompt: 'Au-delà de ce signal :',
    choices: [
      'Le stationnement est interdit du 1er au 15 du mois',
      'Le stationnement est interdit du 16 jusqu’à la fin du mois',
      'L’arrêt et le stationnement sont toujours autorisés',
    ],
    correct: 1,
    signId: 'E7',
    topic: 'stationnement',
  },
  {
    id: 'q-hierarchie',
    prompt: 'Dans l’ordre, que dois-tu respecter en premier ?',
    choices: [
      'Les panneaux de priorité, puis les feux, puis l’agent',
      'L’agent qualifié, puis les feux, puis les panneaux de priorité, puis la priorité de droite',
      'Toujours la priorité de droite avant tout',
    ],
    correct: 1,
    topic: 'hierarchie',
  },
  {
    id: 'q-agent-face',
    prompt: 'Un agent qualifié te fait face (ou te tourne le dos). Que faire ?',
    choices: [
      'Tu peux passer dans toutes les directions',
      'Tu dois t’arrêter',
      'Tu continues si le feu est vert',
    ],
    correct: 1,
    topic: 'agents',
  },
  {
    id: 'q-agent-profil',
    prompt: 'Un agent qualifié est de profil. Que faire ?',
    choices: [
      'Tu dois t’arrêter',
      'Tu peux aller dans toutes les directions',
      'Tu dois faire demi-tour',
    ],
    correct: 1,
    topic: 'agents',
  },
  {
    id: 'q-sirene-gyro',
    prompt: 'Un véhicule prioritaire a sirène + gyrophare. Que faire ?',
    choices: [
      'Continuer normalement',
      'Céder le passage et au besoin s’arrêter',
      'Klaxonner pour les avertir',
    ],
    correct: 1,
    topic: 'prioritaires',
  },
  {
    id: 'q-gyro-seul',
    prompt: 'Un véhicule prioritaire n’a que le gyrophare allumé (pas de sirène). Que faire ?',
    choices: [
      'Céder immédiatement le passage',
      'Continuer ta route normalement',
      'T’arrêter toujours sur place',
    ],
    correct: 1,
    topic: 'prioritaires',
  },
  {
    id: 'q-feu-orange-fixe',
    prompt: 'Feu orange fixe. Que signifie-t-il ?',
    choices: [
      'Le feu est en panne',
      'Arrêt obligatoire sauf s’il n’est pas possible de s’arrêter en sécurité',
      'Comme un feu vert : tu peux passer librement',
    ],
    correct: 1,
    topic: 'feux',
  },
  {
    id: 'q-feu-orange-cligno-milieu',
    prompt: 'Feu orange clignotant au milieu. Que faire ?',
    choices: [
      'Le feu est en panne : franchir en respectant les règles de priorité',
      'Arrêt absolu comme un stop',
      'Interdiction de passer',
    ],
    correct: 0,
    topic: 'feux',
  },
  {
    id: 'q-danger-distance',
    prompt: 'En général, un panneau de danger prend effet :',
    choices: [
      'Immédiatement sous le panneau',
      'Dans environ 150 mètres (sauf panneau additionnel)',
      'Uniquement en agglomération',
    ],
    correct: 1,
    signId: 'A1a',
    topic: 'danger',
  },
  {
    id: 'q-obligation-effet',
    prompt: 'Les panneaux d’obligation :',
    choices: [
      'Prennent effet dans 150 m',
      'Prennent effet immédiatement',
      'Sont toujours facultatifs',
    ],
    correct: 1,
    signId: 'D1a',
    topic: 'obligation',
  },
  {
    id: 'q-stop',
    prompt: 'Face à un panneau STOP, tu dois :',
    choices: [
      'Ralentir fortement sans t’arrêter si la voie est libre',
      'Marquer l’arrêt et céder le passage',
      'Céder le passage sans t’arrêter',
    ],
    correct: 1,
    signId: 'B5',
    topic: 'priorite',
  },
  {
    id: 'q-priorite-droite',
    prompt: 'La priorité de droite s’applique quand :',
    choices: [
      'Il y a toujours un panneau B1',
      'Pas d’agent, pas de feux, pas de panneaux de priorité qui règlent le carrefour',
      'Uniquement sur autoroute',
    ],
    correct: 1,
    signId: 'B17',
    topic: 'priorite',
  },
  {
    id: 'q-tram',
    prompt: 'Le tram :',
    choices: [
      'Doit respecter la priorité de droite comme les voitures',
      'A toujours la priorité envers les autres usagers (ne suit pas les panneaux de priorité ni la priorité de droite)',
      'N’a jamais la priorité',
    ],
    correct: 1,
    topic: 'usagers',
  },
  {
    id: 'q-bande-suggestee',
    prompt: 'La bande cyclable suggérée :',
    choices: [
      'Ne fait pas partie de la chaussée',
      'Fait partie de la chaussée : tu peux y circuler ; l’arrêt/stationnement peut être autorisé dans certains cas',
      'Est réservée uniquement aux piétons',
    ],
    correct: 1,
    topic: 'usagers',
  },
  {
    id: 'q-piste-vs-bande',
    prompt: 'Un cycliste traverse sur une piste cyclable ininterrompue. En général :',
    choices: [
      'Le cycliste est prioritaire sur la voiture qui traverse la piste',
      'La voiture a toujours la priorité',
      'Personne n’a la priorité',
    ],
    correct: 0,
    signId: 'D7',
    topic: 'priorite',
  },
  {
    id: 'q-passage-cycliste-manoeuvre',
    prompt: 'Un cycliste traverse la chaussée sur un passage pour cyclistes :',
    choices: [
      'Il est toujours prioritaire',
      'Il fait une manœuvre : il n’est pas prioritaire (sauf s’il descend et devient piéton)',
      'Tu dois toujours t’arrêter 5 secondes',
    ],
    correct: 1,
    signId: 'A25',
    topic: 'usagers',
  },
  {
    id: 'q-ligne-continue',
    prompt: 'Une ligne blanche continue :',
    choices: [
      'Peut être franchie librement',
      'Interdit de la franchir sauf dans certains cas prévus',
      'Signifie uniquement un stationnement autorisé',
    ],
    correct: 1,
    topic: 'marquages',
  },
  {
    id: 'q-ligne-jaune',
    prompt: 'Une ligne jaune/orange (travaux) :',
    choices: [
      'Est moins importante que la ligne blanche',
      'Est prioritaire par rapport à la ligne blanche',
      'N’a aucune signification',
    ],
    correct: 1,
    topic: 'marquages',
  },
  {
    id: 'q-autoroute-vitesse',
    prompt: 'Sur autoroute, la vitesse maximale générale est :',
    choices: ['90 km/h', '120 km/h', '130 km/h'],
    correct: 1,
    signId: 'F5',
    topic: 'autoroute',
  },
  {
    id: 'q-autoroute-min',
    prompt: 'Sur autoroute, la vitesse minimale réglementée est :',
    choices: [
      '50 km/h toujours',
      '70 km/h en adaptant ton allure aux circonstances',
      '90 km/h obligatoire',
    ],
    correct: 1,
    signId: 'F5',
    topic: 'autoroute',
  },
  {
    id: 'q-bau',
    prompt: 'Sur la bande d’arrêt d’urgence, il est interdit de :',
    choices: [
      'Circuler, s’arrêter et stationner (sauf panne ou accident)',
      'Seulement circuler, l’arrêt est libre',
      'Rien : tu peux t’y garer 10 minutes',
    ],
    correct: 0,
    topic: 'autoroute',
  },
  {
    id: 'q-croisement',
    prompt: 'Le croisement se fait :',
    choices: ['Par la gauche', 'Par la droite', 'Au choix'],
    correct: 1,
    topic: 'manoeuvres',
  },
  {
    id: 'q-depassement',
    prompt: 'Le dépassement se fait :',
    choices: ['Par la droite', 'Par la gauche', 'Toujours par l’accotement'],
    correct: 1,
    topic: 'manoeuvres',
  },
  {
    id: 'q-arret-def',
    prompt: 'Qu’est-ce qu’un arrêt ?',
    choices: [
      'Véhicule immobilisé au-delà du temps pour embarquer/débarquer',
      'Véhicule immobilisé le temps nécessaire pour embarquer/débarquer des personnes ou des choses',
      'Toute immobilisation face à un feu rouge uniquement',
    ],
    correct: 1,
    topic: 'stationnement',
  },
  {
    id: 'q-stationnement-def',
    prompt: 'Attendre quelqu’un au volant, moteur coupé, c’est plutôt :',
    choices: ['Un arrêt', 'Un stationnement', 'Ni arrêt ni stationnement'],
    correct: 1,
    topic: 'stationnement',
  },
  {
    id: 'q-no-parking-sign',
    prompt: 'Panneau « stationnement interdit » (bleu barré) :',
    choices: [
      'Arrêt et stationnement interdits',
      'Stationnement interdit, l’arrêt reste autorisé',
      'Stationnement autorisé 2 h avec disque',
    ],
    correct: 1,
    signId: 'E1',
    topic: 'stationnement',
  },
  {
    id: 'q-zone-bleue',
    prompt: 'Dans une zone bleue, en général :',
    choices: [
      'Stationnement gratuit illimité',
      'Durée limitée (souvent 2 h) avec disque les jours ouvrables aux heures indiquées',
      'Interdiction totale de stationner',
    ],
    correct: 1,
    topic: 'stationnement',
  },
  {
    id: 'q-disque',
    prompt: 'Tu arrives à 12h04 en zone bleue. Sur le disque, tu mets la flèche :',
    choices: ['Sur 12h00', 'Sur 12h30', 'Sur 13h00'],
    correct: 1,
    topic: 'stationnement',
  },
  {
    id: 'q-rond-point-cligno',
    prompt: 'Au rond-point, le clignotant :',
    choices: [
      'N’est jamais obligatoire',
      'Est obligatoire en sortant ; en entrant seulement si tu prends la 1ère sortie',
      'Est obligatoire uniquement en entrant',
    ],
    correct: 1,
    signId: 'D5',
    topic: 'rond-point',
  },
  {
    id: 'q-tirette',
    prompt: 'Le principe de la tirette s’applique si :',
    choices: [
      'Tu t’insères sur autoroute',
      'Réduction du nombre de bandes + forte densité de circulation',
      'Il y a seulement un panneau STOP',
    ],
    correct: 1,
    topic: 'circulation',
  },
  {
    id: 'q-sens-interdit',
    prompt: 'Le panneau « sens interdit » signifie :',
    choices: [
      'Accès interdit dans les deux sens',
      'Interdit à tout conducteur dans ce sens',
      'Stationnement interdit',
    ],
    correct: 1,
    signId: 'C1',
    topic: 'interdiction',
  },
  {
    id: 'q-enfants-vitesse',
    prompt: 'Panneau « endroit fréquenté par des enfants » :',
    choices: [
      'Limitation automatique à 30 km/h',
      'Pas de limitation chiffrée automatique : adapte ton allure en présence d’enfants',
      'Interdiction de dépasser',
    ],
    correct: 1,
    signId: 'A23',
    topic: 'danger',
  },
  // —— Questions théorie (sources type ReadyToRoad / code belge) ——
  {
    id: 'q-d1a-meaning',
    prompt: 'Ce panneau d’obligation (flèche vers le haut) signifie :',
    choices: [
      'Obligation de tourner à droite',
      'Obligation d’aller tout droit',
      'Voie à sens unique',
    ],
    correct: 1,
    signId: 'D1a',
    topic: 'obligation',
  },
  {
    id: 'q-d1a-vs-f19',
    prompt: 'Quelle différence entre D1a (rond bleu) et F19 (rectangle bleu) ?',
    choices: [
      'Aucun : ils ont la même signification',
      'D1a = obligation d’aller tout droit ; F19 = indication de sens unique',
      'D1a = sens unique ; F19 = obligation de tourner',
    ],
    correct: 1,
    signId: 'D1a',
    topic: 'obligation',
  },
  {
    id: 'q-d1b-right',
    prompt: 'Ce panneau (flèche coudée à droite) t’oblige à :',
    choices: [
      'Aller tout droit',
      'Tourner à droite au prochain carrefour',
      'Contourner un obstacle par la gauche',
    ],
    correct: 1,
    signId: 'D1b',
    topic: 'obligation',
  },
  {
    id: 'q-d1d-obstacle',
    prompt: 'Une flèche d’obligation inclinée vers le bas (sur un îlot) signifie surtout :',
    choices: [
      'Stationnement autorisé à droite',
      'Obligation de passer l’obstacle du côté indiqué par la flèche',
      'Fin d’autoroute',
    ],
    correct: 1,
    signId: 'D1d',
    topic: 'obligation',
  },
  {
    id: 'q-d3a-choice',
    prompt: 'Panneau bleu avec flèches « tout droit » et « droite ». Tu peux :',
    choices: [
      'Aller à gauche librement',
      'Aller tout droit ou à droite uniquement',
      'Uniquement tourner à droite',
    ],
    correct: 1,
    signId: 'D3a',
    topic: 'obligation',
  },
  {
    id: 'q-roundabout-priority',
    prompt: 'Dans un rond-point signalé D5, qui a la priorité ?',
    choices: [
      'Celui qui entre',
      'Ceux déjà dans le rond-point',
      'Toujours la priorité de droite',
    ],
    correct: 1,
    signId: 'D5',
    topic: 'rond-point',
  },
  {
    id: 'q-roundabout-enter-blink',
    prompt: 'En entrant dans un rond-point, le clignotant :',
    choices: [
      'Est toujours obligatoire à droite',
      'N’est pas obligatoire sauf si tu prends déjà la 1ère sortie (pour signaler la sortie)',
      'Est interdit',
    ],
    correct: 1,
    signId: 'D5',
    topic: 'rond-point',
  },
  {
    id: 'q-island-default',
    prompt: 'Un îlot sans panneau d’obligation de contournement se contourne :',
    choices: ['Par la gauche', 'Par la droite', 'Au choix'],
    correct: 1,
    topic: 'obligation',
  },
  {
    id: 'q-cede-passage',
    prompt: 'Face à ce panneau, tu dois :',
    choices: [
      'Marquer l’arrêt complet toujours',
      'Céder le passage avant de t’engager',
      'Klaxonner puis passer',
    ],
    correct: 1,
    signId: 'B1',
    topic: 'priorite',
  },
  {
    id: 'q-voie-prioritaire',
    prompt: 'Sur une voie prioritaire (B9) :',
    choices: [
      'Tu cèdes toujours à droite',
      'Les autres doivent en principe te céder le passage (sauf exceptions)',
      'Tu ignores les feux',
    ],
    correct: 1,
    signId: 'B9',
    topic: 'priorite',
  },
  {
    id: 'q-fin-voie-prioritaire',
    prompt: 'Le panneau « fin de voie prioritaire » signifie :',
    choices: [
      'Tu restes prioritaire jusqu’à l’autoroute',
      'Fin du régime prioritaire : retour aux règles normales',
      'Interdiction de dépasser',
    ],
    correct: 1,
    signId: 'B11',
    topic: 'priorite',
  },
  {
    id: 'q-no-entry-vs-access',
    prompt: 'Différence entre C1 (sens interdit) et C3 (accès interdit) ?',
    choices: [
      'Aucune',
      'C1 = interdit dans ce sens ; C3 = accès interdit dans les deux sens',
      'C1 concerne les piétons uniquement',
    ],
    correct: 1,
    signId: 'C1',
    topic: 'interdiction',
  },
  {
    id: 'q-no-overtake',
    prompt: 'Le panneau « dépassement interdit » :',
    choices: [
      'Interdit seulement aux camions',
      'Interdit de dépasser (selon le panneau / catégorie)',
      'Autorise le dépassement à gauche uniquement',
    ],
    correct: 1,
    signId: 'C35',
    topic: 'interdiction',
  },
  {
    id: 'q-speed-limit-end',
    prompt: 'Un panneau de fin de limitation de vitesse signifie :',
    choices: [
      'Tu dois rouler à 30 km/h',
      'Fin de la limitation précédente ; d’autres régimes peuvent s’appliquer',
      'Interdiction de freiner',
    ],
    correct: 1,
    signId: 'C45',
    topic: 'interdiction',
  },
  {
    id: 'q-zone-30',
    prompt: 'Dans une zone 30 :',
    choices: [
      'La vitesse max est 50 km/h',
      'La vitesse max est 30 km/h',
      'Il n’y a aucune limitation',
    ],
    correct: 1,
    topic: 'interdiction',
  },
  {
    id: 'q-no-parking-vs-stopping',
    prompt: 'E1 (stationnement interdit) vs E3 (arrêt et stationnement interdits) :',
    choices: [
      'Identiques',
      'E1 : l’arrêt reste autorisé ; E3 : ni arrêt ni stationnement',
      'E3 autorise le stationnement 5 minutes',
    ],
    correct: 1,
    signId: 'E1',
    topic: 'stationnement',
  },
  {
    id: 'q-agglomeration',
    prompt: 'En agglomération (sauf indication) la vitesse max générale est :',
    choices: ['30 km/h', '50 km/h', '70 km/h'],
    correct: 1,
    signId: 'F1',
    topic: 'indication',
  },
  {
    id: 'q-one-way',
    prompt: 'Le panneau F19 (rectangle bleu, flèche) indique :',
    choices: [
      'Obligation d’aller tout droit',
      'Une voie à sens unique',
      'Un rond-point',
    ],
    correct: 1,
    signId: 'F19',
    topic: 'indication',
  },
  {
    id: 'q-dead-end',
    prompt: 'Le panneau « voie sans issue » signifie :',
    choices: [
      'Interdiction aux piétons',
      'Cul-de-sac pour les véhicules (piétons/cyclistes souvent possibles)',
      'Sens interdit',
    ],
    correct: 1,
    signId: 'F45',
    topic: 'indication',
  },
  {
    id: 'q-slippery',
    prompt: 'Panneau « chaussée glissante ». Que faire ?',
    choices: [
      'Accélérer pour stabiliser',
      'Réduire la vitesse et éviter les freinages brusques',
      'Klaxonner longuement',
    ],
    correct: 1,
    signId: 'A7b',
    topic: 'danger',
  },
  {
    id: 'q-pedestrian-crossing-warn',
    prompt: 'Le triangle « passage pour piétons » :',
    choices: [
      'Remplace le passage piétons lui-même',
      'Annonce un passage piétons : sois prêt à céder le passage',
      'Interdit aux cyclistes',
    ],
    correct: 1,
    signId: 'A21',
    topic: 'danger',
  },
  {
    id: 'q-tram-priority',
    prompt: 'Le tram, en règle générale :',
    choices: [
      'Respecte la priorité de droite comme une voiture',
      'A priorité envers les autres usagers (ne suit pas panneaux de priorité / priorité de droite)',
      'N’a jamais la priorité',
    ],
    correct: 1,
    topic: 'usagers',
  },
  {
    id: 'q-tirette-mandatory',
    prompt: 'Le principe de la tirette est obligatoire quand :',
    choices: [
      'Tu doubles sur autoroute',
      'La circulation est fortement ralentie et une bande prend fin',
      'Il y a un panneau STOP',
    ],
    correct: 1,
    topic: 'circulation',
  },
  {
    id: 'q-obligation-immediate',
    prompt: 'Les panneaux d’obligation (ronds bleus) :',
    choices: [
      'Prennent effet à 150 m',
      'Prennent effet immédiatement (sauf préavis avec distance)',
      'Sont facultatifs',
    ],
    correct: 1,
    signId: 'D1a',
    topic: 'obligation',
  },
  {
    id: 'q-cycle-path-rule',
    prompt: 'Sur une piste cyclable obligatoire (D7), en général :',
    choices: [
      'Les voitures peuvent y stationner 10 min',
      'Les cyclistes doivent l’emprunter ; les autres usagers y sont interdits sauf exceptions',
      'Elle fait partie de la chaussée pour tous',
    ],
    correct: 1,
    signId: 'D7',
    topic: 'obligation',
  },
  {
    id: 'q-narrow-road-priority',
    prompt: 'Panneau « priorité à la circulation venant en sens inverse » :',
    choices: [
      'Tu as priorité dans le rétrécissement',
      'Tu dois céder au sens inverse dans le rétrécissement',
      'Tu dois faire demi-tour',
    ],
    correct: 1,
    signId: 'B15',
    topic: 'priorite',
  },
  {
    id: 'q-stop-complete',
    prompt: 'Au STOP (B5), « marquer l’arrêt » veut dire :',
    choices: [
      'Ralentir à 5 km/h sans s’immobiliser',
      'Immobiliser complètement le véhicule, puis céder le passage',
      'S’arrêter seulement s’il y a du trafic',
    ],
    correct: 1,
    signId: 'B5',
    topic: 'priorite',
  },
];

export function getDrivingSign(id: string): DrivingSign | undefined {
  const code = resolveDrivingSignId(id);
  return DRIVING_SIGNS.find((s) => s.id === code || s.id === id);
}

export function pickDrivingQuestions(count: number, seed: string): DrivingQuestion[] {
  const list = [...DRIVING_QUESTIONS];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  for (let i = list.length - 1; i > 0; i -= 1) {
    h = Math.imul(h ^ i, 16777619);
    const j = Math.abs(h) % (i + 1);
    const tmp = list[i]!;
    list[i] = list[j]!;
    list[j] = tmp;
  }
  return list.slice(0, Math.min(count, list.length));
}

export function signsByCategory(cat: DrivingSignCategory): DrivingSign[] {
  return DRIVING_SIGNS.filter((s) => s.category === cat);
}
