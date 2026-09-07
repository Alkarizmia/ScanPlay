import type { EconomyGlyphId } from './economyGlyph';
import { getGamification, getLevel } from './gamification';
import { getHistory } from './history';
import { getMistakeStats } from './mistakes';
import { getCachedFriendCount } from './social/friendCountCache';
import { countGoldSteps, isPathComplete, normalizeStepProgress, resolvePathStepCount } from './stepProgress';
import type { StepTier } from '../types';
import type { TranslationKey } from './i18n';
import { hasClaimedDailyChestEver } from './wallet';

const MULTI_SCAN_KEY = 'scanplay-multi-scans';
const EXAM_PASS_KEY = 'scanplay-exam-passes';

export type AchievementId =
  | 'first_scan'
  | 'first_step'
  | 'streak_3'
  | 'streak_7'
  | 'streak_14'
  | 'streak_30'
  | 'level_5'
  | 'level_10'
  | 'level_15'
  | 'level_20'
  | 'xp_500'
  | 'xp_1000'
  | 'xp_2500'
  | 'xp_5000'
  | 'scans_10'
  | 'scans_25'
  | 'library_5'
  | 'library_10'
  | 'library_20'
  | 'path_complete'
  | 'paths_3'
  | 'steps_25'
  | 'steps_50'
  | 'triple_games'
  | 'flashcards_pro'
  | 'match_pro'
  | 'quiz_star'
  | 'perfect_quiz'
  | 'words_100'
  | 'words_500'
  | 'gold_first'
  | 'gold_steps_10'
  | 'iron_step'
  | 'bronze_step'
  | 'mistakes_fixed_5'
  | 'mistakes_fixed_20'
  | 'multi_scan'
  | 'exam_pass'
  | 'friends_1'
  | 'friends_3'
  | 'friends_5'
  | 'friends_10'
  | 'first_speak'
  | 'first_chest';

export interface AchievementDef {
  id: AchievementId;
  icon: EconomyGlyphId;
  nameKey: TranslationKey;
  descKey: TranslationKey;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_scan', icon: 'scan', nameKey: 'achFirstScan', descKey: 'achFirstScanDesc' },
  { id: 'first_step', icon: 'path', nameKey: 'achFirstStep', descKey: 'achFirstStepDesc' },
  { id: 'streak_3', icon: 'streak', nameKey: 'achStreak3', descKey: 'achStreak3Desc' },
  { id: 'streak_7', icon: 'streak', nameKey: 'achStreak7', descKey: 'achStreak7Desc' },
  { id: 'streak_14', icon: 'streak', nameKey: 'achStreak14', descKey: 'achStreak14Desc' },
  { id: 'streak_30', icon: 'streak', nameKey: 'achStreak30', descKey: 'achStreak30Desc' },
  { id: 'level_5', icon: 'medal-bronze', nameKey: 'achLevel5', descKey: 'achLevel5Desc' },
  { id: 'level_10', icon: 'medal-silver', nameKey: 'achLevel10', descKey: 'achLevel10Desc' },
  { id: 'level_15', icon: 'medal-gold', nameKey: 'achLevel15', descKey: 'achLevel15Desc' },
  { id: 'level_20', icon: 'gem', nameKey: 'achLevel20', descKey: 'achLevel20Desc' },
  { id: 'xp_500', icon: 'xp', nameKey: 'achXp500', descKey: 'achXp500Desc' },
  { id: 'xp_1000', icon: 'xp', nameKey: 'achXp1000', descKey: 'achXp1000Desc' },
  { id: 'xp_2500', icon: 'xp', nameKey: 'achXp2500', descKey: 'achXp2500Desc' },
  { id: 'xp_5000', icon: 'xp', nameKey: 'achXp5000', descKey: 'achXp5000Desc' },
  { id: 'scans_10', icon: 'scan', nameKey: 'achScans10', descKey: 'achScans10Desc' },
  { id: 'scans_25', icon: 'scan', nameKey: 'achScans25', descKey: 'achScans25Desc' },
  { id: 'library_5', icon: 'write', nameKey: 'achLibrary5', descKey: 'achLibrary5Desc' },
  { id: 'library_10', icon: 'write', nameKey: 'achLibrary10', descKey: 'achLibrary10Desc' },
  { id: 'library_20', icon: 'write', nameKey: 'achLibrary20', descKey: 'achLibrary20Desc' },
  { id: 'path_complete', icon: 'path', nameKey: 'achPathComplete', descKey: 'achPathCompleteDesc' },
  { id: 'paths_3', icon: 'path', nameKey: 'achPaths3', descKey: 'achPaths3Desc' },
  { id: 'steps_25', icon: 'path', nameKey: 'achSteps25', descKey: 'achSteps25Desc' },
  { id: 'steps_50', icon: 'path', nameKey: 'achSteps50', descKey: 'achSteps50Desc' },
  { id: 'triple_games', icon: 'quiz', nameKey: 'achTripleGames', descKey: 'achTripleGamesDesc' },
  { id: 'flashcards_pro', icon: 'write', nameKey: 'achFlashcardsPro', descKey: 'achFlashcardsProDesc' },
  { id: 'match_pro', icon: 'quiz', nameKey: 'achMatchPro', descKey: 'achMatchProDesc' },
  { id: 'quiz_star', icon: 'quiz', nameKey: 'achQuizStar', descKey: 'achQuizStarDesc' },
  { id: 'perfect_quiz', icon: 'quiz', nameKey: 'achPerfectQuiz', descKey: 'achPerfectQuizDesc' },
  { id: 'words_100', icon: 'write', nameKey: 'achWords100', descKey: 'achWords100Desc' },
  { id: 'words_500', icon: 'write', nameKey: 'achWords500', descKey: 'achWords500Desc' },
  { id: 'gold_first', icon: 'medal-gold', nameKey: 'achGoldFirst', descKey: 'achGoldFirstDesc' },
  { id: 'gold_steps_10', icon: 'medal-gold', nameKey: 'achGoldSteps10', descKey: 'achGoldSteps10Desc' },
  { id: 'iron_step', icon: 'medal-iron', nameKey: 'achIronStep', descKey: 'achIronStepDesc' },
  { id: 'bronze_step', icon: 'medal-bronze', nameKey: 'achBronzeStep', descKey: 'achBronzeStepDesc' },
  { id: 'mistakes_fixed_5', icon: 'quiz', nameKey: 'achMistakes5', descKey: 'achMistakes5Desc' },
  { id: 'mistakes_fixed_20', icon: 'path', nameKey: 'achMistakes20', descKey: 'achMistakes20Desc' },
  { id: 'multi_scan', icon: 'scan', nameKey: 'achMultiScan', descKey: 'achMultiScanDesc' },
  { id: 'exam_pass', icon: 'medal-gold', nameKey: 'achExamPass', descKey: 'achExamPassDesc' },
  { id: 'friends_1', icon: 'medal-silver', nameKey: 'achFriends1', descKey: 'achFriends1Desc' },
  { id: 'friends_3', icon: 'medal-silver', nameKey: 'achFriends3', descKey: 'achFriends3Desc' },
  { id: 'friends_5', icon: 'medal-silver', nameKey: 'achFriends5', descKey: 'achFriends5Desc' },
  { id: 'friends_10', icon: 'medal-gold', nameKey: 'achFriends10', descKey: 'achFriends10Desc' },
  { id: 'first_speak', icon: 'listen', nameKey: 'achFirstSpeak', descKey: 'achFirstSpeakDesc' },
  { id: 'first_chest', icon: 'path', nameKey: 'achFirstChest', descKey: 'achFirstChestDesc' },
];

export function recordMultiScan(): void {
  const count = getMultiScanCount() + 1;
  localStorage.setItem(MULTI_SCAN_KEY, String(count));
  void import('./sync').then((m) => m.scheduleSync());
}

export function getMultiScanCount(): number {
  try {
    return parseInt(localStorage.getItem(MULTI_SCAN_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function recordExamPass(): void {
  const count = getExamPassCount() + 1;
  localStorage.setItem(EXAM_PASS_KEY, String(count));
  void import('./sync').then((m) => m.scheduleSync());
}

export function getExamPassCount(): number {
  try {
    return parseInt(localStorage.getItem(EXAM_PASS_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function loadBest(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem('scanplay-best') ?? '{}');
  } catch {
    return {};
  }
}

function getTotalScans(): number {
  try {
    const data = JSON.parse(localStorage.getItem('scanplay-scans-day') ?? '{}') as Record<string, number>;
    return Object.values(data).reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

function getTotalSteps(): number {
  return getHistory().reduce((sum, e) => {
    const p = normalizeStepProgress(e.stepProgress, e.completedSteps);
    return sum + Object.keys(p).length;
  }, 0);
}

function getCompletedPathCount(): number {
  return getHistory().filter((e) =>
    isPathComplete(
      normalizeStepProgress(e.stepProgress, e.completedSteps),
      false,
      resolvePathStepCount(e.pathStepCount),
    ),
  ).length;
}

function getTotalWords(): number {
  return getHistory().reduce((sum, e) => sum + e.pairs.length, 0);
}

function hasAnyStep(): boolean {
  return getHistory().some((e) => {
    const p = normalizeStepProgress(e.stepProgress, e.completedSteps);
    return Object.keys(p).length > 0;
  });
}

function countTierStepsAcrossHistory(tier: StepTier): number {
  return getHistory().reduce((sum, e) => {
    const p = normalizeStepProgress(e.stepProgress, e.completedSteps);
    return sum + Object.values(p).filter((r) => r.tier === tier).length;
  }, 0);
}

function getTotalGoldSteps(): number {
  return getHistory().reduce((sum, e) => {
    const p = normalizeStepProgress(e.stepProgress, e.completedSteps);
    return sum + countGoldSteps(p);
  }, 0);
}

function hasOpenedAnyChest(): boolean {
  if (hasClaimedDailyChestEver()) return true;
  try {
    const raw = localStorage.getItem('scanplay-path-chests');
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, { opened?: boolean }>;
    return Object.values(parsed).some((entry) => entry?.opened);
  } catch {
    return false;
  }
}

export function isAchievementUnlocked(id: AchievementId): boolean {
  const { xp, streak } = getGamification();
  const level = getLevel(xp);
  const history = getHistory();
  const best = loadBest();
  const totalScans = getTotalScans();
  const totalSteps = getTotalSteps();
  const totalWords = getTotalWords();

  switch (id) {
    case 'first_scan':
      return totalScans >= 1 || history.length >= 1;
    case 'first_step':
      return hasAnyStep();
    case 'streak_3':
      return streak >= 3;
    case 'streak_7':
      return streak >= 7;
    case 'streak_14':
      return streak >= 14;
    case 'streak_30':
      return streak >= 30;
    case 'level_5':
      return level >= 5;
    case 'level_10':
      return level >= 10;
    case 'level_15':
      return level >= 15;
    case 'level_20':
      return level >= 20;
    case 'xp_500':
      return xp >= 500;
    case 'xp_1000':
      return xp >= 1000;
    case 'xp_2500':
      return xp >= 2500;
    case 'xp_5000':
      return xp >= 5000;
    case 'scans_10':
      return totalScans >= 10;
    case 'scans_25':
      return totalScans >= 25;
    case 'library_5':
      return history.length >= 5;
    case 'library_10':
      return history.length >= 10;
    case 'library_20':
      return history.length >= 20;
    case 'path_complete':
      return getCompletedPathCount() >= 1;
    case 'paths_3':
      return getCompletedPathCount() >= 3;
    case 'steps_25':
      return totalSteps >= 25;
    case 'steps_50':
      return totalSteps >= 50;
    case 'triple_games':
      return Boolean(best.flashcards && best.quiz && best.match);
    case 'flashcards_pro':
      return (best.flashcards ?? 0) >= 6;
    case 'match_pro':
      return (best.match ?? 0) >= 4;
    case 'quiz_star':
      return (best.quiz ?? 0) >= 5;
    case 'perfect_quiz':
      return (best.quiz ?? 0) >= 6;
    case 'words_100':
      return totalWords >= 100;
    case 'words_500':
      return totalWords >= 500;
    case 'gold_first':
      return getTotalGoldSteps() >= 1;
    case 'gold_steps_10':
      return getTotalGoldSteps() >= 10;
    case 'iron_step':
      return countTierStepsAcrossHistory('iron') >= 1;
    case 'bronze_step':
      return countTierStepsAcrossHistory('bronze') >= 1;
    case 'mistakes_fixed_5':
      return getMistakeStats().corrected >= 5;
    case 'mistakes_fixed_20':
      return getMistakeStats().corrected >= 20;
    case 'multi_scan':
      return getMultiScanCount() >= 1;
    case 'exam_pass':
      return getExamPassCount() >= 1;
    case 'friends_1':
      return getCachedFriendCount() >= 1;
    case 'friends_3':
      return getCachedFriendCount() >= 3;
    case 'friends_5':
      return getCachedFriendCount() >= 5;
    case 'friends_10':
      return getCachedFriendCount() >= 10;
    case 'first_speak':
      return (best.speak ?? 0) >= 1;
    case 'first_chest':
      return hasOpenedAnyChest();
    default:
      return false;
  }
}

export function getAchievementProgress(id: AchievementId): { current: number; target: number } | null {
  const { xp, streak } = getGamification();
  const level = getLevel(xp);
  const history = getHistory();
  const totalScans = getTotalScans();
  const totalSteps = getTotalSteps();
  const totalWords = getTotalWords();

  switch (id) {
    case 'streak_3':
      return { current: Math.min(streak, 3), target: 3 };
    case 'streak_7':
      return { current: Math.min(streak, 7), target: 7 };
    case 'streak_14':
      return { current: Math.min(streak, 14), target: 14 };
    case 'streak_30':
      return { current: Math.min(streak, 30), target: 30 };
    case 'level_5':
      return { current: Math.min(level, 5), target: 5 };
    case 'level_10':
      return { current: Math.min(level, 10), target: 10 };
    case 'level_15':
      return { current: Math.min(level, 15), target: 15 };
    case 'level_20':
      return { current: Math.min(level, 20), target: 20 };
    case 'xp_500':
      return { current: Math.min(xp, 500), target: 500 };
    case 'xp_1000':
      return { current: Math.min(xp, 1000), target: 1000 };
    case 'xp_2500':
      return { current: Math.min(xp, 2500), target: 2500 };
    case 'xp_5000':
      return { current: Math.min(xp, 5000), target: 5000 };
    case 'scans_10':
      return { current: Math.min(totalScans, 10), target: 10 };
    case 'scans_25':
      return { current: Math.min(totalScans, 25), target: 25 };
    case 'library_5':
      return { current: Math.min(history.length, 5), target: 5 };
    case 'library_10':
      return { current: Math.min(history.length, 10), target: 10 };
    case 'library_20':
      return { current: Math.min(history.length, 20), target: 20 };
    case 'paths_3':
      return { current: Math.min(getCompletedPathCount(), 3), target: 3 };
    case 'steps_25':
      return { current: Math.min(totalSteps, 25), target: 25 };
    case 'steps_50':
      return { current: Math.min(totalSteps, 50), target: 50 };
    case 'words_100':
      return { current: Math.min(totalWords, 100), target: 100 };
    case 'words_500':
      return { current: Math.min(totalWords, 500), target: 500 };
    case 'gold_steps_10':
      return { current: Math.min(getTotalGoldSteps(), 10), target: 10 };
    case 'mistakes_fixed_5':
      return { current: Math.min(getMistakeStats().corrected, 5), target: 5 };
    case 'mistakes_fixed_20':
      return { current: Math.min(getMistakeStats().corrected, 20), target: 20 };
    case 'friends_3':
      return { current: Math.min(getCachedFriendCount(), 3), target: 3 };
    case 'friends_5':
      return { current: Math.min(getCachedFriendCount(), 5), target: 5 };
    case 'friends_10':
      return { current: Math.min(getCachedFriendCount(), 10), target: 10 };
    case 'first_speak':
      return { current: Math.min(loadBest().speak ?? 0, 1), target: 1 };
    case 'first_chest':
      return { current: hasOpenedAnyChest() ? 1 : 0, target: 1 };
    default:
      return null;
  }
}

export type AchievementFrame = 'locked' | 'bronze' | 'silver' | 'gold';

const UNLOCKED_FRAME: Record<AchievementId, Exclude<AchievementFrame, 'locked'>> = {
  first_scan: 'bronze',
  first_step: 'bronze',
  first_speak: 'bronze',
  first_chest: 'bronze',
  streak_3: 'bronze',
  streak_7: 'silver',
  streak_14: 'silver',
  streak_30: 'gold',
  level_5: 'bronze',
  level_10: 'silver',
  level_15: 'silver',
  level_20: 'gold',
  xp_500: 'bronze',
  xp_1000: 'silver',
  xp_2500: 'silver',
  xp_5000: 'gold',
  scans_10: 'silver',
  scans_25: 'gold',
  library_5: 'bronze',
  library_10: 'silver',
  library_20: 'gold',
  path_complete: 'silver',
  paths_3: 'gold',
  steps_25: 'silver',
  steps_50: 'gold',
  triple_games: 'silver',
  flashcards_pro: 'silver',
  match_pro: 'silver',
  quiz_star: 'silver',
  perfect_quiz: 'silver',
  words_100: 'silver',
  words_500: 'gold',
  gold_first: 'bronze',
  gold_steps_10: 'gold',
  iron_step: 'bronze',
  bronze_step: 'bronze',
  mistakes_fixed_5: 'silver',
  mistakes_fixed_20: 'gold',
  multi_scan: 'silver',
  exam_pass: 'silver',
  friends_1: 'bronze',
  friends_3: 'silver',
  friends_5: 'silver',
  friends_10: 'gold',
};

export function getAchievementFrame(id: AchievementId, unlocked: boolean): AchievementFrame {
  if (!unlocked) return 'locked';
  return UNLOCKED_FRAME[id];
}

export type AchievementSkin =
  | 'scan'
  | 'path'
  | 'flame'
  | 'level'
  | 'xp'
  | 'library'
  | 'quiz'
  | 'cards'
  | 'match'
  | 'gold'
  | 'iron'
  | 'mistakes'
  | 'exam'
  | 'social'
  | 'speak'
  | 'chest';

export function getAchievementSkin(id: AchievementId): AchievementSkin {
  if (id.startsWith('streak_')) return 'flame';
  if (id.startsWith('level_')) return 'level';
  if (id.startsWith('xp_')) return 'xp';
  if (id === 'first_scan' || id.startsWith('scans_') || id === 'multi_scan') return 'scan';
  if (id.startsWith('library_') || id.startsWith('words_')) return 'library';
  if (id.startsWith('friends_')) return 'social';
  if (id.startsWith('mistakes_')) return 'mistakes';
  switch (id) {
    case 'flashcards_pro':
      return 'cards';
    case 'match_pro':
      return 'match';
    case 'triple_games':
    case 'quiz_star':
    case 'perfect_quiz':
      return 'quiz';
    case 'gold_first':
    case 'gold_steps_10':
      return 'gold';
    case 'iron_step':
    case 'bronze_step':
      return 'iron';
    case 'exam_pass':
      return 'exam';
    case 'first_speak':
      return 'speak';
    case 'first_chest':
      return 'chest';
    default:
      return 'path';
  }
}

export function getUnlockedCount(): number {
  return ACHIEVEMENTS.filter((a) => isAchievementUnlocked(a.id)).length;
}
