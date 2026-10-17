import type { FlowScreen, GameMode, TabId } from '../types';
import { hasAdConsent, needsAdConsentPrompt } from './ads/consent';

type GtagFn = (...args: unknown[]) => void;

/** GA4 measurement ID (must match index.html gtag config). */
export const GA4_MEASUREMENT_ID = 'G-5H74BMT3B3';

const COMPTE_CREE_KEY_PREFIX = 'scanplay-analytics-compte-cree:';
const FIRST_PLAY_KEY_PREFIX = 'scanplay-analytics-first-play:';
const GUEST_SCOPE = 'guest';

/** Account created within this window is treated as a new signup (OAuth / email). */
const NEW_ACCOUNT_MAX_AGE_MS = 5 * 60 * 1000;

function getGtag(): GtagFn | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { gtag?: GtagFn; dataLayer?: unknown[] };
  if (typeof w.gtag === 'function') return w.gtag;
  if (w.dataLayer) {
    return (...args: unknown[]) => {
      w.dataLayer!.push(args);
    };
  }
  return null;
}

/**
 * Mirrors Consent Mode defaults in index.html:
 * likely EEA/UK/CH (banner zone) → only after explicit accept;
 * otherwise analytics defaults to granted.
 */
export function canSendAnalytics(): boolean {
  if (typeof window === 'undefined') return false;
  if (hasAdConsent()) return true;
  if (!needsAdConsentPrompt()) return true;
  return false;
}

export interface AnalyticsScreen {
  /** Nom lisible dans Google Analytics (Temps réel → titre de page / screen_name). */
  name: string;
  /** Identifiant stable (chemin virtuel). */
  id: string;
}

const GAME_SCREENS: Record<GameMode, AnalyticsScreen> = {
  flashcards: { id: 'jeu-cartes', name: 'Jeu · Cartes' },
  quiz: { id: 'jeu-quiz', name: 'Jeu · Quiz' },
  match: { id: 'jeu-association', name: 'Jeu · Association' },
  type: { id: 'jeu-ecriture', name: 'Jeu · Écriture' },
  speak: { id: 'jeu-oral', name: 'Jeu · Oral' },
  listen: { id: 'jeu-ecoute', name: 'Jeu · Écoute' },
  truefalse: { id: 'jeu-vrai-faux', name: 'Jeu · Vrai/Faux' },
  cloze: { id: 'jeu-trous', name: 'Jeu · Texte à trous' },
  translate: { id: 'jeu-traduction', name: 'Jeu · Traduction' },
  dictation: { id: 'jeu-dictee', name: 'Jeu · Dictée' },
  listenpick: { id: 'jeu-mot-entendu', name: 'Jeu · Mot entendu' },
  imagepick: { id: 'jeu-image', name: 'Jeu · Image' },
  reorder: { id: 'jeu-remise-en-ordre', name: 'Jeu · Remise en ordre' },
};

const FLOW_SCREENS: Record<FlowScreen, AnalyticsScreen> = {
  import: { id: 'scanner', name: 'Scanner' },
  pixUniverse: { id: 'univers-pix', name: 'Univers Pix' },
  scanning: { id: 'scan-en-cours', name: 'Scan en cours' },
  modes: { id: 'parcours', name: 'Parcours' },
  playing: { id: 'jeu', name: 'Jeu' },
  lesson: { id: 'lecon-parcours', name: 'Leçon parcours' },
  results: { id: 'resultats', name: 'Résultats' },
  lessonInterstitial: { id: 'entre-jeux', name: 'Entre deux jeux' },
  lessonComplete: { id: 'fin-lecon', name: 'Fin de leçon' },
  multiplayerLobby: { id: 'multijoueur-salon', name: 'Salon multijoueur' },
  multiplayerResults: { id: 'multijoueur-resultats', name: 'Résultats multijoueur' },
  auth: { id: 'connexion', name: 'Connexion' },
  pricing: { id: 'offres', name: 'Offres Plus / Pro' },
  reviewCards: { id: 'revision-cartes', name: 'Révision des cartes' },
  missionReward: { id: 'recompense-missions', name: 'Récompense missions' },
};

const TAB_SCREENS: Record<Exclude<TabId, 'more'>, AnalyticsScreen> = {
  home: { id: 'accueil', name: 'Accueil' },
  history: { id: 'historique', name: 'Historique' },
  friends: { id: 'amis', name: 'Amis' },
  shop: { id: 'boutique', name: 'Boutique' },
  chat: { id: 'coach', name: 'Coach' },
  profile: { id: 'profil', name: 'Profil' },
  mistakes: { id: 'erreurs', name: 'Mes erreurs' },
  achievements: { id: 'succes', name: 'Succès' },
  settings: { id: 'parametres', name: 'Paramètres' },
};

export function resolveAnalyticsScreen(input: {
  tab: TabId;
  flow: FlowScreen | null;
  mode: GameMode | null;
  loggedIn: boolean;
}): AnalyticsScreen | null {
  const { tab, flow, mode, loggedIn } = input;

  if (flow === 'playing' && mode && GAME_SCREENS[mode]) {
    return GAME_SCREENS[mode];
  }
  if (flow && FLOW_SCREENS[flow]) {
    return FLOW_SCREENS[flow];
  }
  if (tab === 'more') return null;
  if (tab === 'home' && !loggedIn) {
    return { id: 'page-de-garde', name: 'Page de garde' };
  }
  return TAB_SCREENS[tab] ?? null;
}

/** Envoie l’écran courant à GA4 (titre lisible + screen_view). */
export function trackScreen(screen: AnalyticsScreen): void {
  if (!canSendAnalytics()) return;
  const gtag = getGtag();
  if (!gtag) return;

  gtag('event', 'screen_view', {
    screen_name: screen.name,
    screen_class: screen.id,
  });
  gtag('event', 'page_view', {
    page_title: screen.name,
    page_location: `${window.location.origin}/${screen.id}`,
  });
}

/** Événements funnel (noms lisibles dans Temps réel → Événements). */
export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  if (!canSendAnalytics()) return;
  const gtag = getGtag();
  if (!gtag) return;
  gtag('event', name, params);
}

/**
 * GA4 user_id as config/set (not a user property). Docs:
 * https://developers.google.com/analytics/devguides/collection/ga4/user-id
 * Cleared with null on logout. Never pass email/name.
 */
export function syncAnalyticsUserId(userId: string | null): void {
  if (!canSendAnalytics()) return;
  const gtag = getGtag();
  if (!gtag) return;
  if (userId) {
    gtag('set', { user_id: userId });
    gtag('config', GA4_MEASUREMENT_ID, { user_id: userId });
  } else {
    gtag('set', { user_id: null });
    gtag('config', GA4_MEASUREMENT_ID, { user_id: null });
  }
}

export function isLikelyNewAccount(createdAt: string | null | undefined, nowMs = Date.now()): boolean {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  const age = nowMs - created;
  return age >= 0 && age < NEW_ACCOUNT_MAX_AGE_MS;
}

function compteCreeStorageKey(userId: string): string {
  return `${COMPTE_CREE_KEY_PREFIX}${userId}`;
}

/** Fire compte_cree at most once per Supabase user id (survives re-login). */
export function trackCompteCreeOnce(
  userId: string,
  params: { confirmation: 'email' | 'direct'; methode: 'email' | 'google' },
): boolean {
  if (!userId) return false;
  try {
    if (localStorage.getItem(compteCreeStorageKey(userId))) return false;
    localStorage.setItem(compteCreeStorageKey(userId), '1');
  } catch {
    /* private mode: still emit once this session */
  }
  trackEvent('compte_cree', {
    confirmation: params.confirmation,
    methode: params.methode,
  });
  return true;
}

type FirstPlayFlags = { started: boolean; completed: boolean };

function firstPlayScope(userId: string | null): string {
  return userId ?? GUEST_SCOPE;
}

function firstPlayStorageKey(scope: string): string {
  return `${FIRST_PLAY_KEY_PREFIX}${scope}`;
}

export function readFirstPlayFlags(userId: string | null): FirstPlayFlags {
  try {
    const raw = localStorage.getItem(firstPlayStorageKey(firstPlayScope(userId)));
    if (!raw) return { started: false, completed: false };
    const parsed = JSON.parse(raw) as Partial<FirstPlayFlags>;
    return {
      started: Boolean(parsed.started),
      completed: Boolean(parsed.completed),
    };
  } catch {
    return { started: false, completed: false };
  }
}

function writeFirstPlayFlags(userId: string | null, flags: FirstPlayFlags): void {
  try {
    localStorage.setItem(firstPlayStorageKey(firstPlayScope(userId)), JSON.stringify(flags));
  } catch {
    /* ignore */
  }
}

export type PremierePartieContext = 'parcours' | 'examen' | 'libre';

/**
 * First successful entry into a scored scan-path game (lesson or single mode).
 * Guest and account scopes are separate (no stitch).
 */
export function trackPremierePartieDemarree(input: {
  userId: string | null;
  mode: GameMode;
  contexte: PremierePartieContext;
}): boolean {
  const flags = readFirstPlayFlags(input.userId);
  if (flags.started) return false;
  writeFirstPlayFlags(input.userId, { ...flags, started: true });
  trackEvent('premiere_partie_demarree', {
    mode: input.mode,
    contexte: input.contexte,
    invite: input.userId ? 'non' : 'oui',
  });
  return true;
}

/**
 * First natural completion of a scored game (not technical, not mid-lesson continue).
 */
export function trackPremierePartieTerminee(input: {
  userId: string | null;
  mode: GameMode;
  contexte: PremierePartieContext;
}): boolean {
  const flags = readFirstPlayFlags(input.userId);
  if (flags.completed) return false;
  writeFirstPlayFlags(input.userId, { started: true, completed: true });
  trackEvent('premiere_partie_terminee', {
    mode: input.mode,
    contexte: input.contexte,
    invite: input.userId ? 'non' : 'oui',
  });
  return true;
}

/** Whether endGame should count as a finished partie for analytics. */
export function isNaturalPartieCompletion(meta?: {
  technical?: boolean;
  lessonContinues?: boolean;
}): boolean {
  if (meta?.technical === true) return false;
  if (meta?.lessonContinues === true) return false;
  return true;
}
