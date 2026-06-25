export type GameMode = 'flashcards' | 'quiz' | 'match' | 'type' | 'speak' | 'listen' | 'truefalse' | 'cloze';

export type SheetType = 'vocab' | 'notes' | 'definitions' | 'math';

export type HistorySubject =
  | 'math'
  | 'history'
  | 'science'
  | 'physics'
  | 'geography'
  | 'literature'
  | 'languages'
  | 'law'
  | 'economics'
  | 'general';

/** Written/reading vs listening/speaking focus for the learning path. */
export type TrainingFocus = 'written' | 'oral';

export type LangCode = 'nl' | 'fr' | 'en' | 'unknown';

export type PairDirection = 'forward' | 'reverse' | 'auto';

export type Plan = 'free' | 'plus' | 'pro';

export type BillingCycle = 'monthly' | 'annual';

export type StepTier = 'gold' | 'iron' | 'bronze';

export interface SubGameResult {
  pct: number;
  tier: StepTier;
}

export interface StepResult {
  pct: number;
  tier: StepTier;
  /** Sous-jeux terminés dans cette leçon (Duolingo-style). */
  games?: Partial<Record<GameMode, SubGameResult>>;
}

export type StepProgressMap = Record<number, StepResult>;

export type TabId =
  | 'home'
  | 'history'
  | 'friends'
  | 'shop'
  | 'profile'
  | 'more'
  | 'mistakes'
  | 'achievements'
  | 'settings';

export type Locale = 'fr' | 'en' | 'nl' | 'es';

export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'es', label: 'Español' },
];

export interface WordPair {
  term: string;
  definition: string;
  termLang?: LangCode;
  defLang?: LangCode;
  /** Emoji pictogram for concrete nouns (vocab games). */
  visual?: string;
}

export interface SessionResult {
  mode: GameMode;
  score: number;
  total: number;
  timeSeconds: number;
  xpEarned?: number;
  examMode?: boolean;
  examPassed?: boolean;
  stepTier?: StepTier;
  stepPct?: number;
  /** Rejeu d'une étape déjà Or — pas d'XP, le meilleur score est conservé. */
  goldReplay?: boolean;
  /** Micro indisponible / skip tout l'oral — affiché −%, pas de note ni pénalité examen. */
  technical?: boolean;
}

export interface GameCompleteMeta {
  technical?: boolean;
  /** Leçon parcours : enchaînement sans changer d'écran. */
  lessonContinues?: boolean;
  mode?: GameMode;
}

export type FlowScreen =
  | 'import'
  | 'scanning'
  | 'modes'
  | 'playing'
  | 'lesson'
  | 'results'
  | 'lessonInterstitial'
  | 'lessonComplete'
  | 'multiplayerLobby'
  | 'multiplayerResults'
  | 'auth'
  | 'pricing';

export interface LessonGameResult {
  mode: GameMode;
  score: number;
  total: number;
  timeSeconds: number;
  xpEarned: number;
  pct: number;
}

export interface LessonSession {
  stepIndex: number;
  games: LessonGameResult[];
  startedAt: number;
}

export interface HistoryEntry {
  id: string;
  title: string;
  pairs: WordPair[];
  thumbnail?: string;
  lastMode?: GameMode;
  /** @deprecated use stepProgress */
  completedSteps?: number[];
  stepProgress?: StepProgressMap;
  /** Progression mode examen (séparée du parcours libre). */
  examStepProgress?: StepProgressMap;
  /** Plus possible d'activer le mode examen sur ce deck. */
  examModeLocked?: boolean;
  lastScorePct?: number;
  lastXpEarned?: number;
  lastPlayedAt?: string;
  playCount?: number;
  /** Nombre d'étapes du parcours au moment du scan (selon le plan). */
  pathStepCount?: number;
  sheetType?: SheetType;
  /** Matière détectée au scan (maths, histoire, langues…). */
  subject?: HistorySubject;
  createdAt: string;
  /** Parcours libre (défaut) — pas un enregistrement d'examen final */
  kind?: 'deck';
}

export interface UserProfile {
  email: string | null;
  isLoggedIn: boolean;
  displayName?: string;
  avatar?: string;
  customAvatarData?: string;
}

export interface GamificationState {
  xp: number;
  streak: number;
  lastPlayDate: string | null;
}

export type UpgradeReason =
  | 'scans'
  | 'words'
  | 'history'
  | 'historyReplay'
  | 'feature'
  | 'export'
  | 'share'
  | 'synthesis'
  | 'exam'
  | 'stats'
  | 'multiplayer';
