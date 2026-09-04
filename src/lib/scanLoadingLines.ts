import { t } from './i18n';
import type { Locale } from '../types';

export type ScanTalkPhase = 'read' | 'decode' | 'build' | 'demo';

const OFFSET_KEY = 'scanplay-pix-talk-v1';

const LINES: Record<Locale, Record<ScanTalkPhase, readonly string[]>> = {
  fr: {
    read: [
      'Pix ouvre ta fiche…',
      'Pix cherche les mots cachés…',
      'Un coup d’œil, Pix s’y met…',
      'Pix aligne les colonnes…',
      'Ça se prépare, reste avec Pix…',
      'Pix lit entre les lignes…',
    ],
    decode: [
      'Pix déchiffre les indices…',
      'Pix relie mot et traduction…',
      'Encore un secret à craquer…',
      'Pix trie ce qui compte…',
      'Les indices s’éclaircissent…',
      'Pix met de l’ordre dans tout ça…',
    ],
    build: [
      'On fabrique tes mini-jeux !',
      'Pix monte le parcours…',
      'Les cartes se rangent…',
      'Presque l’heure de jouer…',
      'Pix met la dernière touche…',
      'Ton aventure est presque prête…',
    ],
    demo: [
      'Pix prépare la démo…',
      'Un aperçu arrive…',
      'Pix installe le terrain de jeu…',
    ],
  },
  en: {
    read: [
      'Pix is opening your sheet…',
      'Pix is hunting hidden words…',
      'One look, Pix gets to work…',
      'Pix is lining up the columns…',
      'Getting ready — stay with Pix…',
      'Pix is reading between the lines…',
    ],
    decode: [
      'Pix is decoding the clues…',
      'Pix is matching words and translations…',
      'One more secret to crack…',
      'Pix is keeping what matters…',
      'The clues are coming into focus…',
      'Pix is sorting it all out…',
    ],
    build: [
      'Building your mini-games!',
      'Pix is setting up the path…',
      'The cards are falling into place…',
      'Almost time to play…',
      'Pix is adding the last touch…',
      'Your adventure is nearly ready…',
    ],
    demo: [
      'Pix is setting up the demo…',
      'A preview is on the way…',
      'Pix is laying out the playground…',
    ],
  },
  nl: {
    read: [
      'Pix opent je blad…',
      'Pix zoekt verborgen woorden…',
      'Eén blik, Pix gaat aan de slag…',
      'Pix zet de kolommen recht…',
      'Het komt eraan, blijf bij Pix…',
      'Pix leest tussen de regels…',
    ],
    decode: [
      'Pix ontcijfert de hints…',
      'Pix koppelt woord en vertaling…',
      'Nog één geheim te kraken…',
      'Pix houdt wat telt…',
      'De hints worden helder…',
      'Pix brengt orde in de chaos…',
    ],
    build: [
      'We bouwen je mini-games!',
      'Pix zet het pad klaar…',
      'De kaarten vallen op hun plaats…',
      'Bijna tijd om te spelen…',
      'Pix zet de laatste puntjes…',
      'Je avontuur is bijna klaar…',
    ],
    demo: [
      'Pix zet de demo klaar…',
      'Een voorproefje komt eraan…',
      'Pix bouwt het speelveld…',
    ],
  },
  es: {
    read: [
      'Pix abre tu ficha…',
      'Pix busca las palabras ocultas…',
      'Una mirada y Pix se pone a ello…',
      'Pix alinea las columnas…',
      'Se prepara, quédate con Pix…',
      'Pix lee entre líneas…',
    ],
    decode: [
      'Pix descifra las pistas…',
      'Pix une palabra y traducción…',
      'Queda un secreto por resolver…',
      'Pix se queda con lo importante…',
      'Las pistas se aclaran…',
      'Pix pone orden en todo esto…',
    ],
    build: [
      '¡Creamos tus mini-juegos!',
      'Pix arma el recorrido…',
      'Las cartas van a su sitio…',
      'Casi es hora de jugar…',
      'Pix da el último toque…',
      'Tu aventura está casi lista…',
    ],
    demo: [
      'Pix prepara la demo…',
      'Llega un adelanto…',
      'Pix monta el terreno de juego…',
    ],
  },
};

export function nextScanTalkOffset(): number {
  try {
    const n = Number(sessionStorage.getItem(OFFSET_KEY) || '0');
    const next = (Number.isFinite(n) ? n : 0) + 1 + Math.floor(Math.random() * 5);
    sessionStorage.setItem(OFFSET_KEY, String(next % 9973));
    return Number.isFinite(n) ? n : Math.floor(Math.random() * 50);
  } catch {
    return Math.floor(Math.random() * 50);
  }
}

export function scanTalkPhase(
  locale: Locale,
  pct: number,
  status: string,
): ScanTalkPhase | 'passthrough' {
  const demo = t('demoLoading', locale);
  const reading = t('reading', locale);
  const scanningAi = t('scanningAi', locale);
  const scanning = t('scanning', locale);
  const building = t('building', locale);

  if (status === demo) return 'demo';
  if (status === building || pct >= 92) return 'build';
  if (status !== reading && status !== scanningAi && status !== scanning) return 'passthrough';
  if (pct < 40) return 'read';
  if (pct < 80) return 'decode';
  return 'build';
}

export function scanTalkLine(locale: Locale, phase: ScanTalkPhase, offset: number, tick: number): string {
  const pool = LINES[locale][phase];
  const step = phase === 'demo' ? 1 : 2;
  const index = ((offset + tick * step) % pool.length + pool.length) % pool.length;
  return pool[index];
}

export function scanTalkPools(): typeof LINES {
  return LINES;
}
