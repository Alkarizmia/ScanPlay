import { ACHIEVEMENTS, isAchievementUnlocked } from './achievements';
import { getUserId } from './auth';
import { getGamification, getLevel } from './gamification';
import { getHistory } from './history';
import { t } from './i18n';
import { getChatHistoryWindow, getChatMaxChars, getDailyChatLimit, getPlan } from './planLimits';
import { getProfile, isDefaultDisplayName } from './profile';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { localCoachReply } from './coachPolicy';
import type { Locale } from '../types';

export interface CoachQuota {
  used: number;
  limit: number;
  remaining: number;
  plan: string;
  maxChars?: number;
  historyWindow?: number;
  voiceEnabled?: boolean;
  voiceProvider?: string;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

function normalizeQuota(row: Partial<CoachQuota> | null | undefined): CoachQuota {
  const fallback = fallbackQuota();
  const limit = Number(row?.limit);
  const used = Number(row?.used);
  const remaining = Number(row?.remaining);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : fallback.limit;
  const safeUsed = Number.isFinite(used) && used >= 0 ? used : 0;
  const safeRemaining = Number.isFinite(remaining)
    ? Math.max(remaining, 0)
    : Math.max(safeLimit - safeUsed, 0);
  return {
    ...fallback,
    ...row,
    used: safeUsed,
    limit: safeLimit,
    remaining: safeRemaining,
    plan: typeof row?.plan === 'string' && row.plan ? row.plan : fallback.plan,
    maxChars: Number(row?.maxChars) || fallback.maxChars,
    historyWindow: Number(row?.historyWindow) || fallback.historyWindow,
  };
}

export function buildCoachContext(locale: Locale) {
  const { xp, streak } = getGamification();
  const windowSize = getChatHistoryWindow();
  const history = getHistory();
  const allowed = history.slice(0, windowSize);
  const locked = history.slice(windowSize);
  const unlocked = ACHIEVEMENTS.filter((item) => isAchievementUnlocked(item.id));
  const profile = getProfile();
  const userId = getUserId();
  const defaultName = isDefaultDisplayName(profile?.displayName ?? '', userId);
  const sheetCount = history.length;
  const isNewAccount = sheetCount === 0 && (defaultName || unlocked.length <= 1 || xp < 50);

  return {
    streak,
    level: getLevel(xp),
    xp,
    sheetCount,
    achievementCount: unlocked.length,
    isNewAccount,
    defaultName,
    displayName: profile?.displayName?.slice(0, 24) ?? '',
    achievements: unlocked.slice(-6).map((item) => t(item.nameKey, locale)),
    allowedSheets: allowed.map((entry) => ({
      title: entry.title,
      pairs: (entry.pairs ?? []).slice(0, 12).map((pair) => ({
        term: pair.term,
        definition: pair.definition,
      })),
    })),
    lockedTitles: locked.map((entry) => entry.title).filter(Boolean).slice(0, 20),
  };
}

function fallbackQuota(): CoachQuota {
  return {
    used: 0,
    limit: getDailyChatLimit(),
    remaining: getDailyChatLimit(),
    plan: getPlan(),
    maxChars: getChatMaxChars(),
    historyWindow: getChatHistoryWindow(),
    voiceEnabled: true,
    voiceProvider: 'groq',
  };
}

export async function fetchCoachQuota(): Promise<CoachQuota | null> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return fallbackQuota();
  const { data, error } = await supabase.rpc('get_coach_chat_quota');
  if (error || !data) return fallbackQuota();
  return normalizeQuota(data as Partial<CoachQuota>);
}

export async function loadCoachMessages(): Promise<CoachMessage[]> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('scanplay_coach_chat_messages')
    .select('id, role, content, created_at')
    .order('created_at', { ascending: true })
    .limit(40);
  if (error || !data) return [];
  return data
    .filter((row) => row.role === 'user' || row.role === 'assistant')
    .map((row) => ({
      id: String(row.id),
      role: row.role as 'user' | 'assistant',
      content: String(row.content ?? ''),
    }));
}

export async function sendCoachMessage(
  message: string,
  locale: Locale,
): Promise<{ reply: string; quota: CoachQuota | null; blocked?: string } | { error: 'quota' | 'rpc' | 'generic' | 'ai' | 'auth'; quota?: CoachQuota }> {
  const context = buildCoachContext(locale);
  const canned = localCoachReply(message, locale, {
    sheetCount: context.sheetCount,
    isNewAccount: context.isNewAccount,
  });

  const supabase = getSupabase();
  const currentQuota = supabase && isSupabaseConfigured ? await fetchCoachQuota() : fallbackQuota();

  if (canned) {
    return { reply: canned, quota: currentQuota, blocked: 'local' };
  }

  if (!supabase || !isSupabaseConfigured) return { error: 'rpc' };

  const { data, error } = await supabase.functions.invoke('coach-chat', {
    body: {
      message,
      locale,
      context,
    },
  });

  const payload = data as {
    error?: string;
    reply?: string;
    quota?: CoachQuota | null;
    blocked?: string;
  } | null;

  if (payload?.reply) {
    return {
      reply: payload.reply,
      quota: payload.quota ? normalizeQuota(payload.quota) : currentQuota,
      blocked: payload.blocked,
    };
  }

  if (payload?.error === 'quota_exceeded') {
    return { error: 'quota', quota: normalizeQuota(payload.quota ?? undefined) };
  }
  if (payload?.error === 'quota_rpc_failed') {
    return { error: 'rpc' };
  }

  const status = Number((error as { context?: { status?: number } } | null)?.context?.status ?? 0);
  if (status === 429) return { error: 'quota', quota: normalizeQuota(payload?.quota ?? undefined) };
  if (status === 401) return { error: 'auth' };
  if (status === 502 || status === 503) return { error: 'ai' };
  if (status === 400 || status === 404) return { error: 'rpc' };
  return { error: 'generic' };
}
