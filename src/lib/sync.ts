import type { HistoryEntry } from '../types';
import { packDeckProgress, unpackDeckProgress } from './examEligibility';
import { getUserId, isLoggedIn } from './auth';
import type { ExamHistoryEntry } from './examHistory';
import { getExamHistory, saveExamHistoryRaw } from './examHistory';
import { getUnlockedCount } from './achievements';
import { getGamification, applyGamificationFromCloud, validateStreak, todayKey } from './gamification';
import { getHistory, saveHistoryRaw } from './history';
import { getLocale } from './i18n';
import { clearLocalUserData } from './localData';
import { getMistakes, saveMistakesRaw } from './mistakes';
import { areNotificationsEnabled } from './preferences';
import { getPlan, setBillingCycle, setPlan } from './planLimits';
import { applySubscriptionMeta, clearSubscriptionMeta } from './subscription';
import { isStripeCheckoutEnabled } from './stripeCheckout';
import { getSupabase } from './supabase';
import { applyIncomingCoins, getCoins, loadWalletRaw, mergeStreakLossFromCloud, STARTING_COINS } from './wallet';

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
    if (plan === 'plus' || plan === 'pro' || plan === 'max' || plan === 'free') {
      setPlan(plan);
    }
    const billing = row.billing_cycle;
    if (billing === 'monthly' || billing === 'annual') {
      setBillingCycle(billing);
    }
    if (plan === 'free') {
      clearSubscriptionMeta();
    } else if (plan === 'plus' || plan === 'pro' || plan === 'max') {
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
      if (sub?.plan === 'plus' || sub?.plan === 'pro' || sub?.plan === 'max') return;
    } catch {
      /* fall through to profile */
    }
  }

  if (profile && (profile.plan === 'plus' || profile.plan === 'pro' || profile.plan === 'max')) {
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

/** Day→count maps for AI envelope: never lose the higher device count. */
function mergeDayCountMaps(
  local: Record<string, unknown> | null | undefined,
  cloud: Record<string, unknown> | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const src of [local, cloud]) {
    if (!src || typeof src !== 'object') continue;
    for (const [day, raw] of Object.entries(src)) {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) continue;
      out[day] = Math.max(out[day] ?? 0, n);
    }
  }
  return out;
}

function readDayCountMap(key: string): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
    return mergeDayCountMaps(raw, null);
  } catch {
    return {};
  }
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
    scansDay: readDayCountMap(SCANS_KEY),
    coachDay: readDayCountMap('scanplay-coach-day'),
    synthesisTokenDay: readDayCountMap('scanplay-synthesis-token-day'),
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
    const merged = mergeDayCountMaps(readDayCountMap(SCANS_KEY), data.scansDay as Record<string, unknown>);
    localStorage.setItem(SCANS_KEY, JSON.stringify(merged));
  }
  if (data.coachDay && typeof data.coachDay === 'object') {
    const merged = mergeDayCountMaps(
      readDayCountMap('scanplay-coach-day'),
      data.coachDay as Record<string, unknown>,
    );
    localStorage.setItem('scanplay-coach-day', JSON.stringify(merged));
  }
  if (data.synthesisTokenDay && typeof data.synthesisTokenDay === 'object') {
    const merged = mergeDayCountMaps(
      readDayCountMap('scanplay-synthesis-token-day'),
      data.synthesisTokenDay as Record<string, unknown>,
    );
    localStorage.setItem('scanplay-synthesis-token-day', JSON.stringify(merged));
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
  const cloudCoins = Number(cloud.coins);
  const keepLocalCoins =
    Number.isFinite(cloudCoins) &&
    local.coins > cloudCoins &&
    cloudCoins <= STARTING_COINS;
  const merged = {
    ...local,
    coins: keepLocalCoins ? local.coins : Number.isFinite(cloudCoins) ? cloudCoins : local.coins,
    gems: Math.max(local.gems, Number(cloud.gems ?? 0)),
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
    translateHints: Math.max(local.translateHints, Number(cloud.translateHints ?? 0)),
    welcomeHintsGranted: Boolean(local.welcomeHintsGranted || cloud.welcomeHintsGranted),
    ownedCosmetics: [
      ...new Set([
        ...(Array.isArray(local.ownedCosmetics) ? local.ownedCosmetics : []),
        ...(Array.isArray(cloud.ownedCosmetics)
          ? cloud.ownedCosmetics.filter((x): x is string => typeof x === 'string')
          : []),
      ]),
    ],
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
    const playedToday = gam.lastPlayDate === todayKey();
    const streakForCloud =
      wallet.lostStreak > 0 && wallet.lostStreakAt && !playedToday ? 0 : gam.streak;

    const profileRow: Record<string, unknown> = {
      user_id: userId,
      xp: gam.xp,
      streak: streakForCloud,
      last_play_date: gam.lastPlayDate,
      streak_lost_value: wallet.lostStreak,
      streak_lost_at: wallet.lostStreakAt,
      streak_lost_ack_at: wallet.lostStreakAckAt,
      locale,
      email_alerts: areNotificationsEnabled(),
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

    // Merge cloud day-maps before push so a stale device cannot wipe higher usage.
    const { data: existingStats } = await supabase
      .from('scanplay_user_stats')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    const cloudData =
      existingStats?.data && typeof existingStats.data === 'object'
        ? (existingStats.data as Record<string, unknown>)
        : {};
    if (cloudData.scansDay && typeof cloudData.scansDay === 'object') {
      localStorage.setItem(
        SCANS_KEY,
        JSON.stringify(
          mergeDayCountMaps(readDayCountMap(SCANS_KEY), cloudData.scansDay as Record<string, unknown>),
        ),
      );
    }
    if (cloudData.coachDay && typeof cloudData.coachDay === 'object') {
      localStorage.setItem(
        'scanplay-coach-day',
        JSON.stringify(
          mergeDayCountMaps(
            readDayCountMap('scanplay-coach-day'),
            cloudData.coachDay as Record<string, unknown>,
          ),
        ),
      );
    }
    if (cloudData.synthesisTokenDay && typeof cloudData.synthesisTokenDay === 'object') {
      localStorage.setItem(
        'scanplay-synthesis-token-day',
        JSON.stringify(
          mergeDayCountMaps(
            readDayCountMap('scanplay-synthesis-token-day'),
            cloudData.synthesisTokenDay as Record<string, unknown>,
          ),
        ),
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

/** True when a Supabase select failed (network/RLS) rather than returning an empty row. */
export function hasQueryError(results: Array<{ error?: unknown }>): boolean {
  return results.some((r) => r.error);
}

export async function pullUserData(options?: {
  checkoutSessionId?: string | null;
  skipStripeSync?: boolean;
}): Promise<boolean> {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return false;

  pullInProgress = true;
  try {
    const [profileRes, deckRes, examRes, mistakeRes, statsRes] = await Promise.all([
      supabase.from('scanplay_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('scanplay_decks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('scanplay_exam_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('scanplay_mistakes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('scanplay_user_stats').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    if (hasQueryError([profileRes, deckRes, examRes, mistakeRes, statsRes])) {
      return false;
    }

    const profile = profileRes.data;
    const deckRows = deckRes.data;
    const examRows = examRes.data;
    const mistakeRows = mistakeRes.data;
    const statsRow = statsRes.data;

    if (statsRow?.data && typeof statsRow.data === 'object') {
      applyStatsBlob(statsRow.data as Record<string, unknown>);
    }

    if (profile) {
      mergeStreakLossFromCloud(
        Number(profile.streak_lost_value ?? 0),
        profile.streak_lost_at as number | null | undefined,
        profile.streak_lost_ack_at as number | null | undefined,
      );
      applyGamification(profile.xp ?? 0, profile.streak ?? 0, profile.last_play_date ?? null);
      const { applyPseudoOnboardingFromCloud } = await import('./profile');
      applyPseudoOnboardingFromCloud(
        Boolean(profile.has_seen_pseudo_tuto) || Boolean(profile.pseudo_onboarding_done_at),
      );
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

    const { mergeProfileFromCloud } = await import('./profile');

    // Public first (name/avatar), then stats blob wins for cosmetics (banner / frames).
    const { data: publicProfile } = await supabase
      .from('scanplay_public_profiles')
      .select('display_name, avatar_id, avatar_url, banner_theme, avatar_frame, banner_frame, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    // Public = identité (nom / photo). Cosmétiques uniquement depuis le blob stats
    // (banner_theme public est souvent resté à "green" et écrasait le vrai fond).
    if (publicProfile) {
      mergeProfileFromCloud({
        displayName: publicProfile.display_name as string | null,
        avatarId: publicProfile.avatar_id as string | null,
        avatarUrl: publicProfile.avatar_url as string | null,
        updatedAt: publicProfile.updated_at as string | null,
      });
    }

    if (statsRow?.data && typeof statsRow.data === 'object') {
      const statsData = statsRow.data as Record<string, unknown>;
      const statsProfile = statsData.profile;
      if (statsProfile && typeof statsProfile === 'object') {
        const p = statsProfile as Record<string, unknown>;
        mergeProfileFromCloud({
          displayName: typeof p.displayName === 'string' ? p.displayName : null,
          avatarId: typeof p.avatar === 'string' ? p.avatar : null,
          avatarUrl: typeof p.customAvatarData === 'string' ? p.customAvatarData : null,
          bannerTheme: typeof p.bannerTheme === 'string' ? p.bannerTheme : null,
          avatarFrame:
            p.avatarFrame === null
              ? null
              : typeof p.avatarFrame === 'string'
                ? p.avatarFrame
                : undefined,
          bannerFrame:
            p.bannerFrame === null
              ? null
              : typeof p.bannerFrame === 'string'
                ? p.bannerFrame
                : undefined,
          updatedAt:
            typeof p.profileUpdatedAt === 'number'
              ? new Date(p.profileUpdatedAt).toISOString()
              : null,
        });
      }
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
    return true;
  } catch {
    return false;
  } finally {
    pullInProgress = false;
  }
}

async function adoptPendingGuestDeckThenPush(): Promise<void> {
  const { adoptPendingGuestDeckIntoHistory } = await import('./pendingGuestDeck');
  adoptPendingGuestDeckIntoHistory();
  await pushUserData();
  notifySyncReady();
}

/** After login/signup: discard guest data, restore cloud, push full snapshot. */
export async function syncAfterLogin(): Promise<void> {
  clearLocalUserData();
  const ok = await pullUserData();
  if (!ok) {
    notifySyncReady();
    return;
  }
  validateStreak();
  await adoptPendingGuestDeckThenPush();
}

/** On app reload while logged in: pull cloud then push full snapshot. */
export async function syncOnSessionRestore(): Promise<void> {
  const ok = await pullUserData();
  if (!ok) {
    notifySyncReady();
    return;
  }
  validateStreak();
  await adoptPendingGuestDeckThenPush();
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

export async function reportPwaInstalled(): Promise<void> {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from('scanplay_profiles')
    .update({ pwa_installed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('pwa_installed_at', null);
  if (error) console.warn('pwa_installed_at', error.message);
}
