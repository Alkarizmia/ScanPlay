import { getGamification, getLevel } from './gamification';
import { getHistory } from './history';
import { getMistakeStats } from './mistakes';
import { getCachedFriendCount } from './social/friendCountCache';
import { countGoldSteps, isPathComplete, normalizeStepProgress, resolvePathStepCount } from './stepProgress';
import type { StepTier } from '../types';
import type { TranslationKey } from './i18n';

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
  | 'friends_10';

export interface AchievementDef {
  id: AchievementId;
  icon: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_scan', icon: '📸', nameKey: 'achFirstScan', descKey: 'achFirstScanDesc' },
  { id: 'first_step', icon: '👣', nameKey: 'achFirstStep', descKey: 'achFirstStepDesc' },
  { id: 'streak_3', icon: '🕯️', nameKey: 'achStreak3', descKey: 'achStreak3Desc' },
  { id: 'streak_7', icon: '🔥', nameKey: 'achStreak7', descKey: 'achStreak7Desc' },
  { id: 'streak_14', icon: '🔥', nameKey: 'achStreak14', descKey: 'achStreak14Desc' },
  { id: 'streak_30', icon: '☄️', nameKey: 'achStreak30', descKey: 'achStreak30Desc' },
  { id: 'level_5', icon: '🌱', nameKey: 'achLevel5', descKey: 'achLevel5Desc' },
  { id: 'level_10', icon: '🏆', nameKey: 'achLevel10', descKey: 'achLevel10Desc' },
  { id: 'level_15', icon: '👑', nameKey: 'achLevel15', descKey: 'achLevel15Desc' },
  { id: 'level_20', icon: '💎', nameKey: 'achLevel20', descKey: 'achLevel20Desc' },
  { id: 'xp_500', icon: '✨', nameKey: 'achXp500', descKey: 'achXp500Desc' },
  { id: 'xp_1000', icon: '⭐', nameKey: 'achXp1000', descKey: 'achXp1000Desc' },
  { id: 'xp_2500', icon: '🌟', nameKey: 'achXp2500', descKey: 'achXp2500Desc' },
  { id: 'xp_5000', icon: '🚀', nameKey: 'achXp5000', descKey: 'achXp5000Desc' },
  { id: 'scans_10', icon: '📷', nameKey: 'achScans10', descKey: 'achScans10Desc' },
  { id: 'scans_25', icon: '🖨️', nameKey: 'achScans25', descKey: 'achScans25Desc' },
  { id: 'library_5', icon: '📚', nameKey: 'achLibrary5', descKey: 'achLibrary5Desc' },
  { id: 'library_10', icon: '📖', nameKey: 'achLibrary10', descKey: 'achLibrary10Desc' },
  { id: 'library_20', icon: '🗂️', nameKey: 'achLibrary20', descKey: 'achLibrary20Desc' },
  { id: 'path_complete', icon: '🎯', nameKey: 'achPathComplete', descKey: 'achPathCompleteDesc' },
  { id: 'paths_3', icon: '🏁', nameKey: 'achPaths3', descKey: 'achPaths3Desc' },
  { id: 'steps_25', icon: '🪜', nameKey: 'achSteps25', descKey: 'achSteps25Desc' },
  { id: 'steps_50', icon: '🧗', nameKey: 'achSteps50', descKey: 'achSteps50Desc' },
  { id: 'triple_games', icon: '🎮', nameKey: 'achTripleGames', descKey: 'achTripleGamesDesc' },
  { id: 'flashcards_pro', icon: '🃏', nameKey: 'achFlashcardsPro', descKey: 'achFlashcardsProDesc' },
  { id: 'match_pro', icon: '🧩', nameKey: 'achMatchPro', descKey: 'achMatchProDesc' },
  { id: 'quiz_star', icon: '❓', nameKey: 'achQuizStar', descKey: 'achQuizStarDesc' },
  { id: 'perfect_quiz', icon: '💯', nameKey: 'achPerfectQuiz', descKey: 'achPerfectQuizDesc' },
  { id: 'words_100', icon: '📝', nameKey: 'achWords100', descKey: 'achWords100Desc' },
  { id: 'words_500', icon: '📜', nameKey: 'achWords500', descKey: 'achWords500Desc' },
  { id: 'gold_first', icon: '🥇', nameKey: 'achGoldFirst', descKey: 'achGoldFirstDesc' },
  { id: 'gold_steps_10', icon: '🏅', nameKey: 'achGoldSteps10', descKey: 'achGoldSteps10Desc' },
  { id: 'iron_step', icon: '⚙️', nameKey: 'achIronStep', descKey: 'achIronStepDesc' },
  { id: 'bronze_step', icon: '🥉', nameKey: 'achBronzeStep', descKey: 'achBronzeStepDesc' },
  { id: 'mistakes_fixed_5', icon: '✅', nameKey: 'achMistakes5', descKey: 'achMistakes5Desc' },
  { id: 'mistakes_fixed_20', icon: '🎯', nameKey: 'achMistakes20', descKey: 'achMistakes20Desc' },
  { id: 'multi_scan', icon: '🖼️', nameKey: 'achMultiScan', descKey: 'achMultiScanDesc' },
  { id: 'exam_pass', icon: '📋', nameKey: 'achExamPass', descKey: 'achExamPassDesc' },
  { id: 'friends_1', icon: '🤝', nameKey: 'achFriends1', descKey: 'achFriends1Desc' },
  { id: 'friends_3', icon: '👥', nameKey: 'achFriends3', descKey: 'achFriends3Desc' },
  { id: 'friends_5', icon: '🫂', nameKey: 'achFriends5', descKey: 'achFriends5Desc' },
  { id: 'friends_10', icon: '🌐', nameKey: 'achFriends10', descKey: 'achFriends10Desc' },
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
    default:
      return null;
  }
}

export function getUnlockedCount(): number {
  return ACHIEVEMENTS.filter((a) => isAchievementUnlocked(a.id)).length;
}
