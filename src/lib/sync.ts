import type { HistoryEntry } from '../types';
import { packDeckProgress, unpackDeckProgress } from './examEligibility';
import { getUserId, isLoggedIn } from './auth';
import type { ExamHistoryEntry } from './examHistory';
import { getExamHistory, saveExamHistoryRaw } from './examHistory';
import { getUnlockedCount } from './achievements';
import { getGamification, applyGamificationFromCloud, validateStreak } from './gamification';
import { getHistory, saveHistoryRaw } from './history';
import { getLocale } from './i18n';
import { clearLocalUserData } from './localData';
import { getMistakes, saveMistakesRaw } from './mistakes';
import { getPlan, setBillingCycle, setPlan } from './planLimits';
import { applySubscriptionMeta, clearSubscriptionMeta } from './subscription';
import { isStripeCheckoutEnabled } from './stripeCheckout';
import { getSupabase } from './supabase';
import { applyIncomingCoins, getCoins, loadWalletRaw, mergeStreakLossFromCloud } from './wallet';

const STATS_KEY = 'scanplay-best';
const MULTI_SCAN_KEY = 'scanplay-multi-scans';
const EXAM_PASS_KEY = 'scanplay-exam-passes';
const SCANS_KEY = 'scanplay-scans-day';

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;
let pullInProgress = false;

async function applyPlanFromCloud(
  profile: Record<string, unknown> | null,
  options?: { checkoutSessionId?: string | null; skipStripeSync?: boolean },
): Promise<void> {
  const applyProfilePlan = (row: Record<string, unknown>) => {
    const plan = row.plan;
    if (plan === 'plus' || plan === 'pro' || plan === 'free') {
      setPlan(plan);
    }
    const billing = row.billing_cycle;
    if (billing === 'monthly' || billing === 'annual') {
      setBillingCycle(billing);
    }
    if (plan === 'free') {
      clearSubscriptionMeta();
    } else if (plan === 'plus' || plan === 'pro') {
      applySubscriptionMeta(
        row.subscription_period_end as string | null | undefined,
        row.subscription_cancel_at_period_end as boolean | null | undefined,
      );
    }
  };

  if (isStripeCheckoutEnabled() && !options?.skipStripeSync) {
    try {
      const { refreshPlanFromStripe } = await import('./stripeCheckout');
      const sub = await refreshPlanFromStripe(options?.checkoutSessionId ?? null);
      if (sub?.plan === 'plus' || sub?.plan === 'pro') return;
    } catch {
      /* fall through to profile */
    }
  }

  if (profile && (profile.plan === 'plus' || profile.plan === 'pro')) {
    applyProfilePlan(profile);
    return;
  }

  if (profile) {
    applyProfilePlan(profile);
    return;
  }

  setPlan('free');
  clearSubscriptionMeta();
}

function collectStatsBlob(): Record<string, unknown> {
  const read = (key: string) => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? 'null');
    } catch {
      return null;
    }
  };
  return {
    best: read(STATS_KEY) ?? {},
    multiScans: read(MULTI_SCAN_KEY) ?? 0,
    examPasses: read(EXAM_PASS_KEY) ?? 0,
    scansDay: read(SCANS_KEY) ?? {},
    notifications: read('scanplay-notifications') ?? [],
    achievementUnlocks: read('scanplay-achievement-unlocks') ?? [],
    achievementTotal: getUnlockedCount(),
    profile: read('scanplay-profile'),
    examHistory: read('scanplay-exam-history') ?? [],
    wallet: read('scanplay-wallet'),
    synthesisMonth: read('scanplay-synthesis-month'),
  };
}

function applyStatsBlob(data: Record<string, unknown>): void {
  if (data.best && typeof data.best === 'object') {
    localStorage.setItem(STATS_KEY, JSON.stringify(data.best));
  }
  if (data.multiScans != null) {
    localStorage.setItem(MULTI_SCAN_KEY, String(data.multiScans));
  }
  if (data.examPasses != null) {
    localStorage.setItem(EXAM_PASS_KEY, String(data.examPasses));
  }
  if (data.scansDay && typeof data.scansDay === 'object') {
    localStorage.setItem(SCANS_KEY, JSON.stringify(data.scansDay));
  }
  if (Array.isArray(data.notifications)) {
    localStorage.setItem('scanplay-notifications', JSON.stringify(data.notifications));
  }
  if (Array.isArray(data.achievementUnlocks)) {
    localStorage.setItem('scanplay-achievement-unlocks', JSON.stringify(data.achievementUnlocks));
  }
  if (data.profile && typeof data.profile === 'object') {
    /* profile merged in pullUserData() — avoids race with public_profiles */
  }
  if (Array.isArray(data.examHistory)) {
    localStorage.setItem('scanplay-exam-history', JSON.stringify(data.examHistory));
  }
  if (data.wallet && typeof data.wallet === 'object') {
    mergeWalletFromCloud(data.wallet as Record<string, unknown>);
  }
  if (data.synthesisMonth && typeof data.synthesisMonth === 'object') {
    localStorage.setItem('scanplay-synthesis-month', JSON.stringify(data.synthesisMonth));
  }
}

function mergeWalletFromCloud(cloud: Record<string, unknown>): void {
  const local = loadWalletRaw();
  const merged = {
    ...local,
    coins: Number(cloud.coins ?? local.coins),
    xpBoostUntil: cloud.xpBoostUntil != null ? Number(cloud.xpBoostUntil) : local.xpBoostUntil,
    lastDailyChest: (cloud.lastDailyChest as string | null) ?? local.lastDailyChest,
    lastAdRewardDate: (cloud.lastAdRewardDate as string | null) ?? local.lastAdRewardDate,
    adWatchesToday: Number(cloud.adWatchesToday ?? local.adWatchesToday),
    lostStreak: Math.max(local.lostStreak, Number(cloud.lostStreak ?? 0)),
    lostStreakAt: Math.max(local.lostStreakAt ?? 0, Number(cloud.lostStreakAt ?? 0)) || null,
    lostStreakAckAt: Math.max(local.lostStreakAckAt ?? 0, Number(cloud.lostStreakAckAt ?? 0)) || null,
    extraScansDate: (cloud.extraScansDate as string | null) ?? local.extraScansDate,
    extraScansBought: Number(cloud.extraScansBought ?? local.extraScansBought),
    synthesisBonusCredits: Number(cloud.synthesisBonusCredits ?? local.synthesisBonusCredits),
    streakFreezeCharges: Math.max(local.streakFreezeCharges, Number(cloud.streakFreezeCharges ?? 0)),
  };
  if (merged.lostStreakAt === 0) merged.lostStreakAt = null;
  if (merged.lostStreakAckAt === 0) merged.lostStreakAckAt = null;
  localStorage.setItem('scanplay-wallet', JSON.stringify(merged));
}

function notifySyncReady(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('scanplay-sync-ready'));
}

export function onSyncReady(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('scanplay-sync-ready', listener);
  return () => window.removeEventListener('scanplay-sync-ready', listener);
}

function applyGamification(xp: number, streak: number, lastPlayDate: string | null): void {
  applyGamificationFromCloud(xp, streak, lastPlayDate);
}

function deckToRow(entry: HistoryEntry, userId: string) {
  const progress = packDeckProgress({
    stepProgress: entry.stepProgress ?? {},
    examStepProgress: entry.examStepProgress ?? {},
    examModeLocked: Boolean(entry.examModeLocked),
  });
  return {
    id: entry.id,
    user_id: userId,
    title: entry.title,
    pairs: entry.pairs,
    thumbnail: entry.thumbnail ?? null,
    last_mode: entry.lastMode ?? null,
    step_progress: progress,
    completed_steps: entry.completedSteps ?? null,
    last_score_pct: entry.lastScorePct ?? null,
    last_xp_earned: entry.lastXpEarned ?? null,
    last_played_at: entry.lastPlayedAt ?? null,
    play_count: entry.playCount ?? 0,
    kind: entry.kind ?? 'deck',
    created_at: entry.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function rowToDeck(row: Record<string, unknown>): HistoryEntry {
  const unpacked = unpackDeckProgress(row.step_progress);
  return {
    id: String(row.id),
    title: String(row.title),
    pairs: (row.pairs as HistoryEntry['pairs']) ?? [],
    thumbnail: (row.thumbnail as string) ?? undefined,
    lastMode: (row.last_mode as HistoryEntry['lastMode']) ?? undefined,
    stepProgress: unpacked.stepProgress,
    examStepProgress: unpacked.examStepProgress,
    examModeLocked: unpacked.examModeLocked,
    completedSteps: (row.completed_steps as number[]) ?? undefined,
    lastScorePct: row.last_score_pct != null ? Number(row.last_score_pct) : undefined,
    lastXpEarned: row.last_xp_earned != null ? Number(row.last_xp_earned) : undefined,
    lastPlayedAt: row.last_played_at != null ? String(row.last_played_at) : undefined,
    playCount: row.play_count != null ? Number(row.play_count) : undefined,
    kind: (row.kind as HistoryEntry['kind']) ?? 'deck',
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function examToRow(entry: ExamHistoryEntry, userId: string) {
  return {
    id: entry.id,
    user_id: userId,
    deck_id: entry.deckId,
    deck_title: entry.deckTitle,
    thumbnail: entry.thumbnail ?? null,
    final_grade: entry.finalGrade,
    passed: entry.passed,
    step_grades: entry.stepGrades,
    path_step_count: entry.pathStepCount ?? null,
    total_time_seconds: entry.totalTimeSeconds,
    created_at: entry.createdAt,
  };
}

function rowToExam(row: Record<string, unknown>): ExamHistoryEntry {
  return {
    id: String(row.id),
    deckId: String(row.deck_id),
    deckTitle: String(row.deck_title),
    thumbnail: (row.thumbnail as string) ?? undefined,
    finalGrade: Number(row.final_grade),
    passed: Boolean(row.passed),
    stepGrades: (row.step_grades as ExamHistoryEntry['stepGrades']) ?? [],
    pathStepCount:
      row.path_step_count != null ? Number(row.path_step_count) : undefined,
    totalTimeSeconds: Number(row.total_time_seconds ?? 0),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export function scheduleSync(): void {
  if (!isLoggedIn() || pullInProgress) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void pushUserData();
  }, 400);
}

/** Push everything to cloud immediately (e.g. before tab close). */
export function flushSync(): void {
  if (!isLoggedIn() || pullInProgress) return;
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  void pushUserData();
}

export async function syncDeleteDeck(id: string): Promise<void> {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return;
  await supabase.from('scanplay_decks').delete().eq('id', id).eq('user_id', userId);
}

export async function syncDeleteExam(id: string): Promise<void> {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return;
  await supabase.from('scanplay_exam_history').delete().eq('id', id).eq('user_id', userId);
}

export async function pushUserData(): Promise<void> {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId || syncing) return;

  syncing = true;
  try {
    const gam = getGamification();
    const wallet = loadWalletRaw();
    const plan = getPlan();
    const locale = getLocale();
    const streakForCloud = wallet.lostStreak > 0 && wallet.lostStreakAt ? 0 : gam.streak;

    const profileRow: Record<string, unknown> = {
      user_id: userId,
      xp: gam.xp,
      streak: streakForCloud,
      last_play_date: gam.lastPlayDate,
      streak_lost_value: wallet.lostStreak,
      streak_lost_at: wallet.lostStreakAt,
      streak_lost_ack_at: wallet.lostStreakAckAt,
      locale,
      updated_at: new Date().toISOString(),
    };
    if (!isStripeCheckoutEnabled()) {
      profileRow.plan = plan;
    }

    await supabase.from('scanplay_profiles').upsert(profileRow);

    const decks = getHistory();
    if (decks.length > 0) {
      await supabase.from('scanplay_decks').upsert(
        decks.map((d) => deckToRow(d, userId)),
      );
    }

    const exams = getExamHistory();
    if (exams.length > 0) {
      await supabase.from('scanplay_exam_history').upsert(
        exams.map((e) => examToRow(e, userId)),
      );
    }

    const mistakes = getMistakes();
    if (mistakes.length > 0) {
      await supabase.from('scanplay_mistakes').upsert(
        mistakes.map((m) => ({
          id: m.id,
          user_id: userId,
          term: m.term,
          definition: m.definition,
          mode: m.mode,
          deck_id: m.deckId ?? null,
          step_index: m.stepIndex ?? null,
          corrected: m.corrected,
          created_at: m.createdAt,
          corrected_at: m.correctedAt ?? null,
        })),
      );
    }

    await supabase.from('scanplay_user_stats').upsert({
      user_id: userId,
      data: collectStatsBlob(),
      updated_at: new Date().toISOString(),
    });

    await supabase.rpc('sync_wallet_coins', { p_coins: getCoins() });

    const { syncPublicProfile } = await import('./social/publicProfile');
    await syncPublicProfile();
  } finally {
    syncing = false;
  }
}

export async function pullUserData(options?: {
  checkoutSessionId?: string | null;
  skipStripeSync?: boolean;
}): Promise<void> {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return;

  pullInProgress = true;
  try {
    const [{ data: profile }, { data: deckRows }, { data: examRows }, { data: mistakeRows }, { data: statsRow }] =
      await Promise.all([
        supabase.from('scanplay_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('scanplay_decks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('scanplay_exam_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('scanplay_mistakes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('scanplay_user_stats').select('*').eq('user_id', userId).maybeSingle(),
      ]);

    if (statsRow?.data && typeof statsRow.data === 'object') {
      const statsData = statsRow.data as Record<string, unknown>;
      applyStatsBlob(statsData);

      const statsProfile = statsData.profile;
      if (statsProfile && typeof statsProfile === 'object') {
        const p = statsProfile as Record<string, unknown>;
        const { mergeProfileFromCloud } = await import('./profile');
        mergeProfileFromCloud({
          displayName: typeof p.displayName === 'string' ? p.displayName : null,
          avatarId: typeof p.avatar === 'string' ? p.avatar : null,
          avatarUrl: typeof p.customAvatarData === 'string' ? p.customAvatarData : null,
          updatedAt:
            typeof p.profileUpdatedAt === 'number'
              ? new Date(p.profileUpdatedAt).toISOString()
              : null,
        });
      }
    }

    if (profile) {
      mergeStreakLossFromCloud(
        Number(profile.streak_lost_value ?? 0),
        profile.streak_lost_at as number | null | undefined,
        profile.streak_lost_ack_at as number | null | undefined,
      );
      applyGamification(profile.xp ?? 0, profile.streak ?? 0, profile.last_play_date ?? null);
    } else {
      applyGamification(0, 0, null);
    }

    await applyPlanFromCloud(profile, options);

    if (deckRows && deckRows.length > 0) {
      saveHistoryRaw(deckRows.map((r) => rowToDeck(r as Record<string, unknown>)));
    } else {
      saveHistoryRaw([]);
    }

    if (examRows && examRows.length > 0) {
      saveExamHistoryRaw(examRows.map((r) => rowToExam(r as Record<string, unknown>)));
    } else {
      saveExamHistoryRaw([]);
    }

    if (mistakeRows && mistakeRows.length > 0) {
      saveMistakesRaw(
        mistakeRows.map((m) => ({
          id: String(m.id),
          term: String(m.term),
          definition: String(m.definition),
          mode: m.mode as import('../types').GameMode,
          deckId: m.deck_id ?? undefined,
          stepIndex: m.step_index ?? undefined,
          corrected: Boolean(m.corrected),
          createdAt: String(m.created_at),
          correctedAt: m.corrected_at ?? undefined,
        })),
      );
    } else {
      saveMistakesRaw([]);
    }

    const { data: publicProfile } = await supabase
      .from('scanplay_public_profiles')
      .select('display_name, avatar_id, avatar_url, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (publicProfile) {
      const { mergeProfileFromCloud } = await import('./profile');
      mergeProfileFromCloud({
        displayName: publicProfile.display_name as string | null,
        avatarId: publicProfile.avatar_id as string | null,
        avatarUrl: publicProfile.avatar_url as string | null,
        updatedAt: publicProfile.updated_at as string | null,
      });
    }

    const { data: walletRows } = await supabase.rpc('get_my_wallet');
    const serverCoins = Array.isArray(walletRows) ? Number(walletRows[0]?.coins) : NaN;
    if (Number.isFinite(serverCoins)) {
      applyIncomingCoins(serverCoins);
    } else {
      const cloudWallet = statsRow?.data && typeof statsRow.data === 'object'
        ? (statsRow.data as Record<string, unknown>).wallet
        : null;
      if (cloudWallet && typeof cloudWallet === 'object') {
        const cloudCoins = Number((cloudWallet as Record<string, unknown>).coins);
        if (Number.isFinite(cloudCoins)) {
          applyIncomingCoins(cloudCoins);
        }
      }
    }
  } finally {
    pullInProgress = false;
  }
}

/** After login/signup: discard guest data, restore cloud, push full snapshot. */
export async function syncAfterLogin(): Promise<void> {
  clearLocalUserData();
  await pullUserData();
  validateStreak();
  await pushUserData();
  notifySyncReady();
}

/** On app reload while logged in: pull cloud then push full snapshot. */
export async function syncOnSessionRestore(): Promise<void> {
  await pullUserData();
  validateStreak();
  await pushUserData();
  notifySyncReady();
}

/** @deprecated use syncAfterLogin */
export async function mergeLocalToCloud(): Promise<void> {
  await syncAfterLogin();
}

export async function syncDeck(entry: HistoryEntry): Promise<void> {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return;
  await supabase.from('scanplay_decks').upsert(deckToRow(entry, userId));
}

export async function syncProfile(): Promise<void> {
  scheduleSync();
}

export async function syncMistakes(): Promise<void> {
  scheduleSync();
}

export async function syncStats(): Promise<void> {
  scheduleSync();
}
