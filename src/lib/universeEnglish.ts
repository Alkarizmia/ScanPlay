import type { WordPair } from '../types';
import {
  ENGLISH_LESSONS,
  lessonsForGoal,
  listChaptersForGoal,
  type CefrLevel,
  type EnglishGoal,
  type EnglishNativeLang,
  type PlacementItem,
} from './englishCurriculum';
import { lookupEnglishNativeGloss, lookupEnglishVocabItem } from './englishVocabLookup';

export const UNIVERSE_ENGLISH_STORAGE_KEY = 'scanplay-universe-english';
const KEY = UNIVERSE_ENGLISH_STORAGE_KEY;

export type { CefrLevel, EnglishGoal, EnglishNativeLang };

const CEFR_RANK: Record<CefrLevel, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
  B2: 3,
  C1: 4,
  C2: 5,
};

/**
 * Missed-word state (synced). Cleared after 2 successes but kept as a tombstone
 * (`cleared: true`) so an older device cannot resurrect the word on merge.
 */
export interface UniverseWeakWord {
  word: string;
  misses: number;
  /** Consecutive successes toward clearance (0–2). */
  streak: number;
  updatedAt: number;
  /** Tombstone after 2 successes — not reinjected, wins merge if newest. */
  cleared?: boolean;
}

export interface UniverseEnglishProfile {
  onboarded: boolean;
  level: CefrLevel;
  goal: EnglishGoal;
  nativeLang: EnglishNativeLang;
  /** Lesson currently in progress (resume target). */
  currentLessonId: string;
  completedLessonIds: string[];
  /** Chapters unlocked via hard skip exam (all lessons marked done). */
  skippedChapterIds: string[];
  /** Missed EN lemmas to reinject in later lesson review slots. */
  weakWords: UniverseWeakWord[];
  /** Last account that owned this cache (avoids mixing two users on one device). */
  cloudUserId?: string | null;
  updatedAt: number;
}

const DEFAULT: UniverseEnglishProfile = {
  onboarded: false,
  level: 'A1',
  goal: 'travel',
  nativeLang: 'fr',
  currentLessonId: 'travel-greet-l01',
  completedLessonIds: [],
  skippedChapterIds: [],
  weakWords: [],
  cloudUserId: null,
  updatedAt: 0,
};

function normalizeWeakWords(raw: unknown): UniverseWeakWord[] {
  if (!Array.isArray(raw)) return [];
  const out: UniverseWeakWord[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    // Migrate legacy `{ en, successes }` shape.
    const word = String(row.word ?? row.en ?? '').trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const misses = Number(row.misses);
    const streakRaw = row.streak ?? row.successes;
    const streak = Number(streakRaw);
    const updatedAt = Number(row.updatedAt);
    const cleared = Boolean(row.cleared) || (Number.isFinite(streak) && streak >= 2);
    out.push({
      word,
      misses: Number.isFinite(misses) ? Math.max(0, Math.floor(misses)) : 0,
      streak: Number.isFinite(streak) ? Math.min(2, Math.max(0, Math.floor(streak))) : 0,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
      cleared: cleared || undefined,
    });
  }
  return out;
}

/** Active weak words only (not cleared tombstones). */
export function activeUniverseWeakWords(words: UniverseWeakWord[]): UniverseWeakWord[] {
  return words.filter((w) => !w.cleared && w.streak < 2);
}

/** Per-word merge: keep the entry with the newest updatedAt (tombstones included). */
export function mergeWeakWordLists(a: UniverseWeakWord[], b: UniverseWeakWord[]): UniverseWeakWord[] {
  const map = new Map<string, UniverseWeakWord>();
  for (const entry of [...a, ...b]) {
    const key = entry.word.toLowerCase();
    const prev = map.get(key);
    if (!prev || entry.updatedAt >= prev.updatedAt) {
      map.set(key, { ...entry });
    }
  }
  return [...map.values()];
}

function isCefrLevel(value: unknown): value is CefrLevel {
  return value === 'A1' || value === 'A2' || value === 'B1' || value === 'B2' || value === 'C1' || value === 'C2';
}

function isEnglishGoal(value: unknown): value is EnglishGoal {
  return (
    value === 'travel' ||
    value === 'work' ||
    value === 'school' ||
    value === 'exam' ||
    value === 'fun' ||
    value === 'other'
  );
}

function isNativeLang(value: unknown): value is EnglishNativeLang {
  return value === 'fr' || value === 'nl' || value === 'es' || value === 'ar';
}

function unionIds(a: string[], b: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...a, ...b]) {
    const key = id.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** Normalize unknown JSON (localStorage or Supabase) into a profile. */
export function coerceUniverseEnglishProfile(raw: unknown): UniverseEnglishProfile {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT };
  const parsed = raw as Partial<UniverseEnglishProfile>;
  const updatedAt = Number(parsed.updatedAt);
  return {
    ...DEFAULT,
    ...parsed,
    level: isCefrLevel(parsed.level) ? parsed.level : DEFAULT.level,
    goal: isEnglishGoal(parsed.goal) ? parsed.goal : DEFAULT.goal,
    nativeLang: isNativeLang(parsed.nativeLang) ? parsed.nativeLang : DEFAULT.nativeLang,
    currentLessonId:
      typeof parsed.currentLessonId === 'string' && parsed.currentLessonId
        ? parsed.currentLessonId
        : DEFAULT.currentLessonId,
    completedLessonIds: Array.isArray(parsed.completedLessonIds)
      ? parsed.completedLessonIds.filter((id): id is string => typeof id === 'string')
      : [],
    skippedChapterIds: Array.isArray(parsed.skippedChapterIds)
      ? parsed.skippedChapterIds.filter((id): id is string => typeof id === 'string')
      : [],
    weakWords: normalizeWeakWords(parsed.weakWords),
    onboarded: Boolean(parsed.onboarded),
    cloudUserId:
      typeof parsed.cloudUserId === 'string' && parsed.cloudUserId
        ? parsed.cloudUserId
        : parsed.cloudUserId === null
          ? null
          : DEFAULT.cloudUserId,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

/**
 * Merge local + remote progress.
 * Unions for lessons / skips / weak words; level+goal+cursor from the newer updatedAt.
 */
export function mergeUniverseEnglishProfiles(
  local: UniverseEnglishProfile,
  remote: UniverseEnglishProfile,
  remoteUpdatedAtMs: number,
): UniverseEnglishProfile {
  const remoteNewer = remoteUpdatedAtMs >= (local.updatedAt || 0);
  const newer = remoteNewer ? remote : local;
  return {
    ...newer,
    onboarded: local.onboarded || remote.onboarded,
    completedLessonIds: unionIds(local.completedLessonIds, remote.completedLessonIds),
    skippedChapterIds: unionIds(local.skippedChapterIds, remote.skippedChapterIds),
    weakWords: mergeWeakWordLists(local.weakWords, remote.weakWords),
    level: newer.level,
    goal: newer.goal,
    nativeLang: newer.nativeLang,
    currentLessonId: newer.currentLessonId,
    updatedAt: Math.max(local.updatedAt || 0, remoteUpdatedAtMs || 0, Date.now()),
  };
}

function loadRaw(): UniverseEnglishProfile {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown;
    return coerceUniverseEnglishProfile(parsed);
  } catch {
    return { ...DEFAULT };
  }
}

function scheduleCloudPush(): void {
  void import('./universeProgressSync')
    .then((m) => m.scheduleUniverseEnglishPush())
    .catch(() => {});
}

function save(profile: UniverseEnglishProfile): void {
  const next = { ...profile, updatedAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(next));
  scheduleCloudPush();
}

/** Write profile to local cache; optionally skip scheduling a cloud push (used by sync merge). */
export function replaceUniverseEnglishProfile(
  profile: UniverseEnglishProfile,
  options?: { skipCloudPush?: boolean },
): void {
  const next = { ...profile, updatedAt: profile.updatedAt || Date.now() };
  localStorage.setItem(KEY, JSON.stringify(next));
  if (!options?.skipCloudPush) scheduleCloudPush();
}

function pathFor(goal: EnglishGoal) {
  return lessonsForGoal(goal);
}

/** Highest CEFR label that actually appears on lessons for this goal. */
export function maxLevelForGoal(goal: EnglishGoal): CefrLevel {
  const path = pathFor(goal);
  let max: CefrLevel = 'A1';
  for (const lesson of path) {
    if (CEFR_RANK[lesson.level] > CEFR_RANK[max]) max = lesson.level;
  }
  return max;
}

/** Clamp a requested level down to what the goal path actually offers. */
export function clampLevelToGoal(goal: EnglishGoal, level: CefrLevel): CefrLevel {
  const max = maxLevelForGoal(goal);
  return CEFR_RANK[level] > CEFR_RANK[max] ? max : level;
}

/**
 * First lesson at the requested level, or at the highest available level ≤ request.
 * Never falls back to chapter 1 when the user asked for a higher CEFR.
 */
function firstLessonId(goal: EnglishGoal, level: CefrLevel): string {
  const path = pathFor(goal);
  if (path.length === 0) return DEFAULT.currentLessonId;
  const clamped = clampLevelToGoal(goal, level);
  const exact = path.find((l) => l.level === clamped);
  if (exact) return exact.id;
  let target: CefrLevel = 'A1';
  for (const lesson of path) {
    if (CEFR_RANK[lesson.level] <= CEFR_RANK[clamped] && CEFR_RANK[lesson.level] >= CEFR_RANK[target]) {
      target = lesson.level;
    }
  }
  return (path.find((l) => l.level === target) ?? path[path.length - 1]!).id;
}

/** Progress for Univers English — never touches History. */
export function getUniverseEnglish(): UniverseEnglishProfile {
  const profile = loadRaw();
  const path = pathFor(profile.goal);
  if (profile.onboarded && path.length > 0 && !path.some((l) => l.id === profile.currentLessonId)) {
    const migrated: UniverseEnglishProfile = {
      ...profile,
      currentLessonId: firstLessonId(profile.goal, profile.level),
      completedLessonIds: [],
      skippedChapterIds: [],
      updatedAt: Date.now(),
    };
    save(migrated);
    return migrated;
  }
  return profile;
}

export function isUniverseEnglishOnboarded(): boolean {
  return loadRaw().onboarded;
}

export function saveUniverseEnglishOnboarding(input: {
  level: CefrLevel;
  goal: EnglishGoal;
  nativeLang: EnglishNativeLang;
}): UniverseEnglishProfile {
  const level = clampLevelToGoal(input.goal, input.level);
  const next: UniverseEnglishProfile = {
    onboarded: true,
    level,
    goal: input.goal,
    nativeLang: input.nativeLang,
    currentLessonId: firstLessonId(input.goal, level),
    completedLessonIds: [],
    skippedChapterIds: [],
    weakWords: [],
    updatedAt: Date.now(),
  };
  save(next);
  return next;
}

function pairFromEnglishTerm(en: string, nativeLang: EnglishNativeLang): WordPair | null {
  const item = lookupEnglishVocabItem(en);
  const gloss = item
    ? item[nativeLang]
    : lookupEnglishNativeGloss(en, nativeLang === 'ar' ? 'fr' : nativeLang);
  if (!gloss) return null;
  return {
    term: item?.en ?? en,
    definition: gloss,
    faces: item?.sentence ? [item.sentence] : undefined,
    termLang: 'en',
    defLang: nativeLang === 'ar' ? 'unknown' : nativeLang,
  };
}

/** Review slots ≈ last 3 items of a 7-word lesson — prefer reinjecting missed words there. */
const REVIEW_SLOT_COUNT = 3;

export function injectWeakWordsIntoPairs(
  pairs: WordPair[],
  weakWords: UniverseWeakWord[],
  nativeLang: EnglishNativeLang,
): WordPair[] {
  const active = activeUniverseWeakWords(weakWords);
  if (pairs.length === 0 || active.length === 0) return pairs;
  const out = pairs.map((p) => ({ ...p }));
  const present = new Set(out.map((p) => p.term.toLowerCase()));
  const candidates = active.filter((w) => !present.has(w.word.toLowerCase()));
  let slot = out.length - 1;
  let injected = 0;
  for (const weak of candidates) {
    if (injected >= REVIEW_SLOT_COUNT || slot < 0) break;
    const pair = pairFromEnglishTerm(weak.word, nativeLang);
    if (!pair) continue;
    out[slot] = pair;
    present.add(pair.term.toLowerCase());
    slot -= 1;
    injected += 1;
  }
  return out;
}

export function getEnglishLessonPairs(lessonId: string, nativeLang: EnglishNativeLang): WordPair[] {
  const lesson = ENGLISH_LESSONS.find((l) => l.id === lessonId);
  if (!lesson) return [];
  const base = lesson.items.map((item) => ({
    term: item.en,
    definition: item[nativeLang],
    faces: item.sentence ? [item.sentence] : undefined,
    termLang: 'en' as const,
    defLang: (nativeLang === 'ar' ? 'unknown' : nativeLang) as WordPair['defLang'],
  }));
  const profile = loadRaw();
  if (profile.goal !== lesson.goal) return base;
  return injectWeakWordsIntoPairs(base, profile.weakWords, nativeLang);
}

export function recordUniverseWeakWord(en: string): void {
  const term = en.trim();
  if (!term) return;
  const profile = loadRaw();
  const key = term.toLowerCase();
  const now = Date.now();
  const existing = profile.weakWords.find((w) => w.word.toLowerCase() === key);
  const nextEntry: UniverseWeakWord = {
    word: existing?.word ?? term,
    misses: (existing?.misses ?? 0) + 1,
    streak: 0,
    updatedAt: now,
    cleared: false,
  };
  const weakWords = existing
    ? profile.weakWords.map((w) => (w.word.toLowerCase() === key ? nextEntry : w))
    : [...profile.weakWords, nextEntry];
  save({ ...profile, weakWords, updatedAt: now });
}

/** +1 success streak; after 2 successes keep a cleared tombstone (for sync merge). */
export function recordUniverseWeakSuccess(en: string): void {
  const term = en.trim();
  if (!term) return;
  const profile = loadRaw();
  const key = term.toLowerCase();
  const existing = profile.weakWords.find((w) => w.word.toLowerCase() === key && !w.cleared);
  if (!existing) return;
  const now = Date.now();
  const streak = existing.streak + 1;
  const nextEntry: UniverseWeakWord =
    streak >= 2
      ? { word: existing.word, misses: existing.misses, streak: 2, updatedAt: now, cleared: true }
      : { ...existing, streak, updatedAt: now, cleared: false };
  const weakWords = profile.weakWords.map((w) =>
    w.word.toLowerCase() === key ? nextEntry : w,
  );
  save({ ...profile, weakWords, updatedAt: now });
}

export function getCurrentEnglishLesson() {
  const profile = loadRaw();
  const path = pathFor(profile.goal);
  return path.find((l) => l.id === profile.currentLessonId) ?? path[0] ?? ENGLISH_LESSONS[0]!;
}

export function listEnglishLessonsForLevel(level: CefrLevel) {
  const profile = loadRaw();
  return pathFor(profile.goal).filter((l) => l.level === level);
}

export function listEnglishPathLessons() {
  const profile = loadRaw();
  return pathFor(profile.goal);
}

export function completeEnglishLesson(lessonId: string): UniverseEnglishProfile {
  const profile = loadRaw();
  const path = pathFor(profile.goal);
  const completed = profile.completedLessonIds.includes(lessonId)
    ? profile.completedLessonIds
    : [...profile.completedLessonIds, lessonId];
  const idx = path.findIndex((l) => l.id === lessonId);
  const nextLesson = path[Math.min(idx + 1, path.length - 1)] ?? path[0]!;
  const next: UniverseEnglishProfile = {
    ...profile,
    completedLessonIds: completed,
    currentLessonId: nextLesson.id,
    level: nextLesson.level,
    updatedAt: Date.now(),
  };
  save(next);
  return next;
}

export function setEnglishCurrentLesson(lessonId: string): void {
  const profile = loadRaw();
  if (!ENGLISH_LESSONS.some((l) => l.id === lessonId)) return;
  save({ ...profile, currentLessonId: lessonId, updatedAt: Date.now() });
}

/** Manual correction of level and/or goal. Resumes at first lesson for that level on the goal path. */
export function updateUniverseEnglishProfile(input: {
  level?: CefrLevel;
  goal?: EnglishGoal;
}): UniverseEnglishProfile {
  const profile = loadRaw();
  const goal = input.goal ?? profile.goal;
  const level = clampLevelToGoal(goal, input.level ?? profile.level);
  const pathChanged = goal !== profile.goal || level !== profile.level;
  const next: UniverseEnglishProfile = {
    ...profile,
    level,
    goal,
    currentLessonId: pathChanged ? firstLessonId(goal, level) : profile.currentLessonId,
    completedLessonIds: pathChanged && goal !== profile.goal ? [] : profile.completedLessonIds,
    skippedChapterIds: pathChanged && goal !== profile.goal ? [] : profile.skippedChapterIds,
    weakWords: pathChanged && goal !== profile.goal ? [] : profile.weakWords,
    updatedAt: Date.now(),
  };
  save(next);
  return next;
}

export function isChapterFullyDone(
  chapter: { id: string; lessonIds: string[] },
  profile: UniverseEnglishProfile = loadRaw(),
): boolean {
  if (profile.skippedChapterIds.includes(chapter.id)) return true;
  return chapter.lessonIds.every((id) => profile.completedLessonIds.includes(id));
}

/** Chapter N unlocks only if chapter N-1 is fully done (or skipped). */
export function isChapterUnlocked(
  chapters: { id: string; lessonIds: string[] }[],
  chapterIndex: number,
  profile: UniverseEnglishProfile = loadRaw(),
): boolean {
  if (chapterIndex <= 0) return true;
  const prev = chapters[chapterIndex - 1];
  return prev ? isChapterFullyDone(prev, profile) : true;
}

/** Ultra-basic A1 glosses — fine in lessons, too soft for a B1+ skip gate. */
const SKIP_EXAM_TOO_EASY = new Set([
  'hi',
  'hello',
  'bye',
  'yes',
  'no',
  'please',
  'thanks',
  'thank you',
  "you're welcome",
  'good morning',
  'good afternoon',
  'good evening',
  'good night',
  'goodbye',
  'sorry',
  'ok',
  'okay',
]);

function skipExamDifficulty(
  term: string,
  lessonIndex: number,
  lessonLevel: CefrLevel,
): number {
  const words = term.trim().split(/\s+/).filter(Boolean).length;
  const key = term.trim().toLowerCase().replace(/[’']/g, "'");
  const basicPenalty = SKIP_EXAM_TOO_EASY.has(key) ? -80 : 0;
  return CEFR_RANK[lessonLevel] * 24 + lessonIndex * 4 + Math.min(term.length, 36) + words * 6 + basicPenalty;
}

/** Vocab pool for a hard chapter skip exam (deduped, biased to harder items). */
export function getChapterExamPairs(
  chapterId: string,
  nativeLang: EnglishNativeLang,
  userLevel: CefrLevel = 'A1',
): WordPair[] {
  const lessons = ENGLISH_LESSONS.filter((l) => l.chapterId === chapterId);
  const seen = new Set<string>();
  const scored: { pair: WordPair; score: number; easy: boolean }[] = [];

  lessons.forEach((lesson, lessonIndex) => {
    for (const item of lesson.items) {
      const key = item.en.toLowerCase().replace(/[’']/g, "'");
      if (seen.has(key)) continue;
      seen.add(key);
      const score = skipExamDifficulty(item.en, lessonIndex, lesson.level);
      scored.push({
        score,
        easy: SKIP_EXAM_TOO_EASY.has(key),
        pair: {
          term: item.en,
          definition: item[nativeLang],
          faces: item.sentence ? [item.sentence] : undefined,
          termLang: 'en',
          defLang: nativeLang === 'ar' ? 'unknown' : nativeLang,
        },
      });
    }
  });

  scored.sort((a, b) => b.score - a.score);

  const want = 16;
  const userRank = CEFR_RANK[userLevel];
  let pool = scored;
  // From B1 up: drop ultra-basic fillers when the chapter still has enough meat.
  if (userRank >= CEFR_RANK.B1) {
    const hard = scored.filter((x) => !x.easy);
    if (hard.length >= 8) pool = hard;
  }

  return pool.slice(0, want).map((x) => x.pair);
}

/** Pass skip exam → mark chapter done and jump to first lesson of next chapter. */
export function skipEnglishChapter(chapterId: string): UniverseEnglishProfile {
  const profile = loadRaw();
  const chapters = listChaptersForGoal(profile.goal);
  const ch = chapters.find((c) => c.id === chapterId);
  if (!ch) return profile;
  const completed = new Set(profile.completedLessonIds);
  for (const id of ch.lessonIds) completed.add(id);
  const skipped = profile.skippedChapterIds.includes(chapterId)
    ? profile.skippedChapterIds
    : [...profile.skippedChapterIds, chapterId];
  const idx = chapters.findIndex((c) => c.id === chapterId);
  const nextCh = chapters[idx + 1];
  const nextLessonId = nextCh?.lessonIds[0] ?? ch.lessonIds[ch.lessonIds.length - 1]!;
  const next: UniverseEnglishProfile = {
    ...profile,
    completedLessonIds: [...completed],
    skippedChapterIds: skipped,
    currentLessonId: nextLessonId,
    updatedAt: Date.now(),
  };
  save(next);
  return next;
}

/** Max wrong answers allowed on a chapter skip exam (2 wrongs = fail). */
export const CHAPTER_SKIP_MAX_WRONG = 1;

/** @deprecated use updateUniverseEnglishProfile */
export function updateUniverseEnglishLevel(level: CefrLevel): UniverseEnglishProfile {
  return updateUniverseEnglishProfile({ level });
}

/**
 * Strict placement → CEFR.
 * C2 needs near-perfect overall + strong C1/C2 band; easy lucky streaks cannot skip ahead.
 */
export function estimateLevelFromPlacement(
  answers: { correct: boolean; levelHint: CefrLevel }[],
  goal?: EnglishGoal,
): CefrLevel {
  if (answers.length === 0) return goal ? clampLevelToGoal(goal, 'A1') : 'A1';
  const rank = CEFR_RANK;
  const levels = Object.keys(rank) as CefrLevel[];

  const bandStats = (lv: CefrLevel) => {
    const band = answers.filter((a) => a.levelHint === lv);
    if (band.length === 0) return { ok: 0, total: 0, pct: 0 };
    const ok = band.filter((a) => a.correct).length;
    return { ok, total: band.length, pct: ok / band.length };
  };

  const overallOk = answers.filter((a) => a.correct).length;
  const overallPct = overallOk / answers.length;

  // Cap: first wrong on a band blocks that band and above (softened by later recovery below).
  let maxByMistake: CefrLevel = 'C2';
  for (const a of answers) {
    if (!a.correct) {
      const idx = Math.max(0, rank[a.levelHint] - 1);
      const capped = levels[idx]!;
      if (rank[capped] < rank[maxByMistake]) maxByMistake = capped;
    }
  }

  let estimated: CefrLevel = 'A1';
  for (const lv of levels) {
    const lowerOk = levels
      .filter((x) => rank[x] < rank[lv])
      .every((x) => {
        const s = bandStats(x);
        return s.total === 0 || s.pct >= 0.75;
      });
    const self = bandStats(lv);
    const need =
      lv === 'C2' ? 1 : lv === 'C1' ? 0.85 : lv === 'B2' ? 0.8 : lv === 'B1' ? 0.75 : 0.7;
    const overallNeed =
      lv === 'C2' ? 0.92 : lv === 'C1' ? 0.85 : lv === 'B2' ? 0.75 : lv === 'B1' ? 0.65 : 0.5;
    if (lowerOk && self.total > 0 && self.pct >= need && overallPct >= overallNeed) {
      estimated = lv;
    }
  }

  if (rank[estimated] > rank[maxByMistake]) estimated = maxByMistake;
  // C2 only if C2 band perfect and overall excellent
  if (estimated === 'C2') {
    const c2 = bandStats('C2');
    const c1 = bandStats('C1');
    if (c2.pct < 1 || c1.pct < 0.75 || overallPct < 0.92) {
      estimated = 'C1';
    }
  }
  return goal ? clampLevelToGoal(goal, estimated) : estimated;
}

/** @deprecated use estimateLevelFromPlacement(answers) */
export function estimateLevelFromPlacementLegacy(correct: number, total: number): CefrLevel {
  const pct = total > 0 ? correct / total : 0;
  if (pct < 0.35) return 'A1';
  if (pct < 0.5) return 'A2';
  if (pct < 0.65) return 'B1';
  if (pct < 0.8) return 'B2';
  if (pct < 0.92) return 'C1';
  return 'C2';
}

export function placementPrompt(item: PlacementItem): string {
  return item.sentence ? `${item.en}\n${item.sentence}` : item.en;
}

export function resetUniverseEnglish(): void {
  localStorage.removeItem(KEY);
  void import('./universeProgressSync')
    .then((m) => m.cancelUniverseProgressSync())
    .catch(() => {});
}
