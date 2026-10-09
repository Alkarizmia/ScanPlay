/** Pix Univers — driving license theory progress (local for now). */

export const UNIVERSE_DRIVING_STORAGE_KEY = 'scanplay-universe-driving';
const KEY = UNIVERSE_DRIVING_STORAGE_KEY;

export type DrivingCountryId = 'be' | 'fr' | 'nl' | 'de' | 'es' | 'lu';

export interface DrivingCountryDef {
  id: DrivingCountryId;
  available: boolean;
}

/** Catalog order in the country picker. Only Belgium is playable for now. */
export const DRIVING_COUNTRIES: DrivingCountryDef[] = [
  { id: 'be', available: true },
  { id: 'fr', available: false },
  { id: 'nl', available: false },
  { id: 'de', available: false },
  { id: 'es', available: false },
  { id: 'lu', available: false },
];

export interface DrivingCountryProgress {
  /** Questions the learner has already answered (ids, when content exists). */
  answeredQuestionIds: string[];
  correctCount: number;
  wrongCount: number;
  /** Sign ids opened in learn mode. */
  learnedSignIds: string[];
  /** Sessions / practice rounds started. */
  sessionsStarted: number;
  /** Exams passed. */
  examsPassed: number;
  updatedAt: number;
}

export interface UniverseDrivingProfile {
  /** Last selected country (null until first choice). */
  countryId: DrivingCountryId | null;
  byCountry: Partial<Record<DrivingCountryId, DrivingCountryProgress>>;
  updatedAt: number;
}

function emptyCountryProgress(): DrivingCountryProgress {
  return {
    answeredQuestionIds: [],
    correctCount: 0,
    wrongCount: 0,
    learnedSignIds: [],
    sessionsStarted: 0,
    examsPassed: 0,
    updatedAt: Date.now(),
  };
}

function normalizeCountryProgress(raw?: Partial<DrivingCountryProgress>): DrivingCountryProgress {
  const base = emptyCountryProgress();
  if (!raw) return base;
  return {
    answeredQuestionIds: Array.isArray(raw.answeredQuestionIds) ? raw.answeredQuestionIds : [],
    correctCount: typeof raw.correctCount === 'number' ? raw.correctCount : 0,
    wrongCount: typeof raw.wrongCount === 'number' ? raw.wrongCount : 0,
    learnedSignIds: Array.isArray(raw.learnedSignIds) ? raw.learnedSignIds : [],
    sessionsStarted: typeof raw.sessionsStarted === 'number' ? raw.sessionsStarted : 0,
    examsPassed: typeof raw.examsPassed === 'number' ? raw.examsPassed : 0,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  };
}

function defaultProfile(): UniverseDrivingProfile {
  return {
    countryId: null,
    byCountry: {},
    updatedAt: Date.now(),
  };
}

function loadRaw(): UniverseDrivingProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Partial<UniverseDrivingProfile>;
    return {
      countryId: parsed.countryId ?? null,
      byCountry: parsed.byCountry && typeof parsed.byCountry === 'object' ? parsed.byCountry : {},
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return defaultProfile();
  }
}

function save(profile: UniverseDrivingProfile): UniverseDrivingProfile {
  const next = { ...profile, updatedAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function getUniverseDriving(): UniverseDrivingProfile {
  return loadRaw();
}

export function isDrivingCountryAvailable(id: DrivingCountryId): boolean {
  return DRIVING_COUNTRIES.some((c) => c.id === id && c.available);
}

export function getDrivingCountryProgress(
  countryId: DrivingCountryId,
  profile: UniverseDrivingProfile = loadRaw(),
): DrivingCountryProgress {
  return normalizeCountryProgress(profile.byCountry[countryId]);
}

/** Select a country (only available ones). Creates progress bucket if needed. */
export function selectDrivingCountry(countryId: DrivingCountryId): UniverseDrivingProfile {
  if (!isDrivingCountryAvailable(countryId)) return loadRaw();
  const profile = loadRaw();
  const byCountry = { ...profile.byCountry };
  if (!byCountry[countryId]) byCountry[countryId] = emptyCountryProgress();
  return save({
    ...profile,
    countryId,
    byCountry,
  });
}

/** Back to country picker without wiping per-country progress. */
export function clearDrivingCountrySelection(): UniverseDrivingProfile {
  const profile = loadRaw();
  return save({ ...profile, countryId: null });
}

export function getDrivingAnsweredCount(countryId: DrivingCountryId): number {
  return getDrivingCountryProgress(countryId).answeredQuestionIds.length;
}

/** Hook for future theory games — record one answered question. */
export function recordDrivingAnswer(
  countryId: DrivingCountryId,
  questionId: string,
  correct: boolean,
): UniverseDrivingProfile {
  if (!isDrivingCountryAvailable(countryId)) return loadRaw();
  const profile = loadRaw();
  const prev = getDrivingCountryProgress(countryId, profile);
  const ids = prev.answeredQuestionIds.includes(questionId)
    ? prev.answeredQuestionIds
    : [...prev.answeredQuestionIds, questionId];
  const already = prev.answeredQuestionIds.includes(questionId);
  return save({
    ...profile,
    countryId: profile.countryId ?? countryId,
    byCountry: {
      ...profile.byCountry,
      [countryId]: {
        ...prev,
        answeredQuestionIds: ids,
        correctCount: already ? prev.correctCount : prev.correctCount + (correct ? 1 : 0),
        wrongCount: already ? prev.wrongCount : prev.wrongCount + (correct ? 0 : 1),
        updatedAt: Date.now(),
      },
    },
  });
}

export function bumpDrivingSession(countryId: DrivingCountryId): UniverseDrivingProfile {
  if (!isDrivingCountryAvailable(countryId)) return loadRaw();
  const profile = loadRaw();
  const prev = getDrivingCountryProgress(countryId, profile);
  return save({
    ...profile,
    countryId: profile.countryId ?? countryId,
    byCountry: {
      ...profile.byCountry,
      [countryId]: {
        ...prev,
        sessionsStarted: prev.sessionsStarted + 1,
        updatedAt: Date.now(),
      },
    },
  });
}

export function markDrivingSignLearned(signId: string, countryId: DrivingCountryId = 'be'): UniverseDrivingProfile {
  if (!isDrivingCountryAvailable(countryId)) return loadRaw();
  const profile = loadRaw();
  const prev = getDrivingCountryProgress(countryId, profile);
  if (prev.learnedSignIds.includes(signId)) return profile;
  return save({
    ...profile,
    countryId: profile.countryId ?? countryId,
    byCountry: {
      ...profile.byCountry,
      [countryId]: {
        ...prev,
        learnedSignIds: [...prev.learnedSignIds, signId],
        updatedAt: Date.now(),
      },
    },
  });
}

export function recordDrivingExamPassed(countryId: DrivingCountryId = 'be'): UniverseDrivingProfile {
  if (!isDrivingCountryAvailable(countryId)) return loadRaw();
  const profile = loadRaw();
  const prev = getDrivingCountryProgress(countryId, profile);
  return save({
    ...profile,
    countryId: profile.countryId ?? countryId,
    byCountry: {
      ...profile.byCountry,
      [countryId]: {
        ...prev,
        examsPassed: prev.examsPassed + 1,
        updatedAt: Date.now(),
      },
    },
  });
}
