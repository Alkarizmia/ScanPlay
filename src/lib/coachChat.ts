import { ACHIEVEMENTS, isAchievementUnlocked } from './achievements';
import { getUserId } from './auth';
import { getGamification, getLevel } from './gamification';
import { getHistory } from './history';
import { t } from './i18n';
import { getChatHistoryWindow, getChatMaxChars, getDailyChatLimit, getPlan } from './planLimits';
import { getProfile, isDefaultDisplayName } from './profile';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { localCoachReply } from './coachPolicy';
import type { Locale, WordPair } from '../types';

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

export interface CoachConversation {
  id: string;
  title: string;
  updatedAt: string;
}

function normalizeQuota(row: Partial<CoachQuota> | null | undefined): CoachQuota {
  const fallback = fallbackQuota();
  const limit = Number(row?.limit);
  const used = Number(row?.used);
  const remaining = Number(row?.remaining);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : fallback.limit;
  const safeUsed = Number.isFinite(used) && used >= 0 ? Math.min(used, safeLimit) : 0;
  let safeRemaining = Math.max(safeLimit - safeUsed, 0);
  if (
    Number.isFinite(remaining) &&
    remaining >= 0 &&
    remaining <= safeLimit &&
    !(safeUsed === 0 && remaining === 0 && safeLimit > 0)
  ) {
    safeRemaining = Math.max(remaining, 0);
  }
  if (safeUsed === 0 && safeLimit > 0) {
    safeRemaining = safeLimit;
  }
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

export async function fetchCoachQuota(): Promise<CoachQuota | null> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return fallbackQuota();
  const { data, error } = await supabase.rpc('get_coach_chat_quota');
  if (error || data == null) return fallbackQuota();
  const row = (Array.isArray(data) ? data[0] : data) as Partial<CoachQuota> | null;
  return normalizeQuota(row);
}

export function buildCoachContext(
  locale: Locale,
  extras?: { pendingPairs?: WordPair[]; pendingTitle?: string },
) {
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

  const pendingPairs = extras?.pendingPairs?.slice(0, 24) ?? [];
  const chatSheet =
    pendingPairs.length > 0
      ? [
          {
            title: extras?.pendingTitle?.slice(0, 60) || 'Fiche du chat',
            pairs: pendingPairs.map((pair) => ({
              term: pair.term,
              definition: pair.definition,
            })),
          },
        ]
      : [];

  return {
    streak,
    level: getLevel(xp),
    xp,
    sheetCount: sheetCount + (pendingPairs.length > 0 ? 1 : 0),
    achievementCount: unlocked.length,
    isNewAccount: isNewAccount && pendingPairs.length === 0,
    defaultName,
    displayName: profile?.displayName?.slice(0, 24) ?? '',
    achievements: unlocked.slice(-6).map((item) => t(item.nameKey, locale)),
    allowedSheets: [
      ...chatSheet,
      ...allowed.map((entry) => ({
        title: entry.title,
        pairs: (entry.pairs ?? []).slice(0, 12).map((pair) => ({
          term: pair.term,
          definition: pair.definition,
        })),
      })),
    ],
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

export function titleFromFirstMessage(message: string): string {
  const cleaned = message.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Nouvelle conversation';
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}

export async function purgeEmptyCoachConversations(): Promise<void> {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !isSupabaseConfigured || !userId) return;

  const { data: rows } = await supabase
    .from('scanplay_coach_conversations')
    .select('id, scanplay_coach_chat_messages(id)')
    .eq('user_id', userId)
    .limit(80);
  if (!rows?.length) return;

  const emptyIds = rows
    .filter((row) => {
      const msgs = (row as { scanplay_coach_chat_messages?: unknown }).scanplay_coach_chat_messages;
      return !Array.isArray(msgs) || msgs.length === 0;
    })
    .map((row) => String(row.id));
  if (emptyIds.length === 0) return;
  await supabase.from('scanplay_coach_conversations').delete().in('id', emptyIds);
}

export async function listCoachConversations(): Promise<CoachConversation[]> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return [];
  await purgeEmptyCoachConversations();

  const { data, error } = await supabase
    .from('scanplay_coach_conversations')
    .select('id, title, updated_at, scanplay_coach_chat_messages(id)')
    .order('updated_at', { ascending: false })
    .limit(40);
  if (error || !data) {
    // Fallback if nested select unavailable
    const plain = await supabase
      .from('scanplay_coach_conversations')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false })
      .limit(40);
    if (plain.error || !plain.data) return [];
    return plain.data.map((row) => ({
      id: String(row.id),
      title: String(row.title || 'Conversation'),
      updatedAt: String(row.updated_at ?? ''),
    }));
  }

  return data
    .filter((row) => {
      const msgs = (row as { scanplay_coach_chat_messages?: unknown }).scanplay_coach_chat_messages;
      return Array.isArray(msgs) && msgs.length > 0;
    })
    .map((row) => ({
      id: String(row.id),
      title: String(row.title || 'Conversation'),
      updatedAt: String(row.updated_at ?? ''),
    }));
}

export async function createCoachConversation(title = 'Nouvelle conversation'): Promise<CoachConversation | null> {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !isSupabaseConfigured || !userId) return null;
  const { data, error } = await supabase
    .from('scanplay_coach_conversations')
    .insert({ user_id: userId, title: title.slice(0, 60) })
    .select('id, title, updated_at')
    .single();
  if (error || !data) return null;
  return {
    id: String(data.id),
    title: String(data.title || title),
    updatedAt: String(data.updated_at ?? ''),
  };
}

export async function deleteCoachConversation(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return;
  await supabase.from('scanplay_coach_conversations').delete().eq('id', id);
}

export async function renameCoachConversation(id: string, title: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return;
  await supabase
    .from('scanplay_coach_conversations')
    .update({ title: titleFromFirstMessage(title), updated_at: new Date().toISOString() })
    .eq('id', id);
}

export async function touchCoachConversation(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return;
  await supabase
    .from('scanplay_coach_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id);
}

/** Latest conversation that already has messages — never creates an empty one. */
export async function ensureActiveConversation(): Promise<CoachConversation | null> {
  const list = await listCoachConversations();
  return list[0] ?? null;
}

function mapMessageRows(
  data: { id: unknown; role: unknown; content: unknown }[],
): CoachMessage[] {
  return data
    .filter((row) => row.role === 'user' || row.role === 'assistant')
    .map((row) => ({
      id: String(row.id),
      role: row.role as 'user' | 'assistant',
      content: String(row.content ?? ''),
    }));
}

export async function loadCoachMessages(conversationId?: string | null): Promise<CoachMessage[]> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured) return [];

  const loadAll = async () => {
    const { data, error } = await supabase
      .from('scanplay_coach_chat_messages')
      .select('id, role, content, created_at')
      .order('created_at', { ascending: true })
      .limit(40);
    if (error || !data) return [];
    return mapMessageRows(data);
  };

  if (conversationId) {
    const { data, error } = await supabase
      .from('scanplay_coach_chat_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(40);

    // Column missing / schema not migrated → fall back to flat history
    if (error) return loadAll();
    if (data && data.length > 0) return mapMessageRows(data);

    // Legacy / orphan turns (saved before conversations existed) → claim into this thread
    const { data: orphans, error: orphanError } = await supabase
      .from('scanplay_coach_chat_messages')
      .select('id, role, content, created_at')
      .is('conversation_id', null)
      .order('created_at', { ascending: true })
      .limit(40);
    if (orphanError) return loadAll();
    if (orphans && orphans.length > 0) {
      const ids = orphans.map((row) => String(row.id));
      await supabase
        .from('scanplay_coach_chat_messages')
        .update({ conversation_id: conversationId })
        .in('id', ids);
      return mapMessageRows(orphans);
    }
    return [];
  }

  return loadAll();
}

/** Persist a full turn so leaving Coach never loses the exchange. */
export async function persistCoachExchange(
  conversationId: string | null | undefined,
  userContent: string,
  assistantContent: string,
): Promise<boolean> {
  const supabase = getSupabase();
  const userId = getUserId();
  if (!supabase || !isSupabaseConfigured || !userId) return false;

  const userMsg = userContent.trim();
  const assistantMsg = assistantContent.trim();
  if (!userMsg || !assistantMsg) return false;

  const withConv = conversationId
    ? [
        { user_id: userId, role: 'user' as const, content: userMsg, conversation_id: conversationId },
        {
          user_id: userId,
          role: 'assistant' as const,
          content: assistantMsg,
          conversation_id: conversationId,
        },
      ]
    : [
        { user_id: userId, role: 'user' as const, content: userMsg },
        { user_id: userId, role: 'assistant' as const, content: assistantMsg },
      ];

  let { error } = await supabase.from('scanplay_coach_chat_messages').insert(withConv);
  if (error && conversationId) {
    // Column / FK not ready yet → fall back without conversation_id
    ({ error } = await supabase.from('scanplay_coach_chat_messages').insert([
      { user_id: userId, role: 'user', content: userMsg },
      { user_id: userId, role: 'assistant', content: assistantMsg },
    ]));
  }
  if (error) {
    console.warn('[coach] persist failed', error.message);
    return false;
  }
  if (conversationId) void touchCoachConversation(conversationId);
  return true;
}

export async function sendCoachMessage(
  message: string,
  locale: Locale,
  options?: {
    conversationId?: string | null;
    pendingPairs?: WordPair[];
    pendingTitle?: string;
    isFirstMessage?: boolean;
  },
): Promise<
  | { reply: string; quota: CoachQuota | null; blocked?: string }
  | { error: 'quota' | 'rpc' | 'generic' | 'ai' | 'auth' | 'plan'; quota?: CoachQuota }
> {
  const context = buildCoachContext(locale, {
    pendingPairs: options?.pendingPairs,
    pendingTitle: options?.pendingTitle,
  });
  if (getPlan() === 'free' || getDailyChatLimit() <= 0) {
    return { error: 'plan' };
  }

  const canned = localCoachReply(message, locale, {
    sheetCount: context.sheetCount,
    isNewAccount: context.isNewAccount,
  });

  const supabase = getSupabase();
  const currentQuota = supabase && isSupabaseConfigured ? await fetchCoachQuota() : fallbackQuota();
  const conversationId = options?.conversationId ?? null;

  if (canned) {
    if (conversationId && options?.isFirstMessage) {
      void renameCoachConversation(conversationId, message);
    } else if (conversationId) {
      void touchCoachConversation(conversationId);
    }
    await persistCoachExchange(conversationId, message, canned);
    void import('./achievements').then((m) => m.recordCoachUsed());
    return { reply: canned, quota: currentQuota, blocked: 'local' };
  }

  if (!supabase || !isSupabaseConfigured) return { error: 'rpc' };

  if (conversationId && options?.isFirstMessage) {
    void renameCoachConversation(conversationId, message);
  } else if (conversationId) {
    void touchCoachConversation(conversationId);
  }

  const { data, error } = await supabase.functions.invoke('coach-chat', {
    body: {
      message,
      locale,
      context,
      conversationId,
    },
  });

  let payload = data as {
    error?: string;
    reply?: string;
    quota?: CoachQuota | null;
    blocked?: string;
  } | null;

  let status = Number((error as { context?: { status?: number } } | null)?.context?.status ?? 0);
  if (error && (!payload || !payload.reply)) {
    try {
      const res = (error as { context?: Response }).context;
      if (res && typeof res.json === 'function') {
        const body = (await res.clone().json()) as typeof payload;
        if (body && typeof body === 'object') payload = body;
        if (!status && typeof res.status === 'number') status = res.status;
      }
    } catch {
      /* ignore parse errors */
    }
  }

  if (payload?.reply) {
    await persistCoachExchange(conversationId, message, payload.reply);
    void import('./achievements').then((m) => m.recordCoachUsed());
    return {
      reply: payload.reply,
      quota: payload.quota ? normalizeQuota(payload.quota) : currentQuota,
      blocked: payload.blocked,
    };
  }

  if (payload?.error === 'plan_required' || status === 403) {
    return { error: 'plan' };
  }
  if (payload?.error === 'quota_exceeded') {
    return { error: 'quota', quota: normalizeQuota(payload.quota ?? undefined) };
  }
  if (payload?.error === 'quota_rpc_failed') {
    return { error: 'rpc' };
  }

  if (status === 429) return { error: 'quota', quota: normalizeQuota(payload?.quota ?? undefined) };
  if (status === 401) return { error: 'auth' };
  if (status === 502 || status === 503) return { error: 'ai' };
  if (status === 400 || status === 404) return { error: 'rpc' };
  return { error: 'generic' };
}
