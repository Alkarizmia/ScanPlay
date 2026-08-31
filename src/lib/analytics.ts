import type { FlowScreen, GameMode, TabId } from '../types';

type GtagFn = (...args: unknown[]) => void;

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
};

const FLOW_SCREENS: Record<FlowScreen, AnalyticsScreen> = {
  import: { id: 'scanner', name: 'Scanner' },
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
};

const TAB_SCREENS: Record<Exclude<TabId, 'more'>, AnalyticsScreen> = {
  home: { id: 'accueil', name: 'Accueil' },
  history: { id: 'historique', name: 'Historique' },
  friends: { id: 'amis', name: 'Amis' },
  shop: { id: 'boutique', name: 'Boutique' },
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
  const gtag = getGtag();
  if (!gtag) return;
  gtag('event', name, params);
}
