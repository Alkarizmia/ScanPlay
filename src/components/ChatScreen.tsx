import { useEffect, useRef, useState } from 'react';
import {
  createCoachConversation,
  deleteCoachConversation,
  ensureActiveConversation,
  fetchCoachQuota,
  listCoachConversations,
  loadCoachConversationSheet,
  loadCoachMessages,
  persistCoachExchange,
  saveCoachConversationSheet,
  sendCoachMessage,
  titleFromFirstMessage,
  type CoachConversation,
  type CoachMessage,
  type CoachQuota,
} from '../lib/coachChat';
import { getHistory } from '../lib/history';
import { getChatMaxChars, getDailyChatLimit } from '../lib/planLimits';
import { canSpendAiBudget, getAiUsageRatio } from '../lib/planUsage';
import { isCoachChatEnabled } from '../lib/coachFlag';
import { t } from '../lib/i18n';
import { onSyncReady, pullUserData } from '../lib/sync';
import { speakText } from '../lib/speech';
import { canRecordCoachVoice, recordSpeechWithVAD, transcribeViaServer } from '../lib/speechServer';
import { extractPairsFromImage } from '../lib/sheetAnalysis';
import { createThumbnail } from '../lib/thumbnail';
import { canUseSynthesis, recordSynthesisUsage } from '../lib/synthesisQuota';
import { downloadSynthesisWord, generateSynthesis, printSynthesisPdf } from '../lib/synthesis';
import { canOpenGamePath, coercePlayablePairs } from '../lib/vocabulary';
import { ChatArrowIcon } from './icons/ChatArrowIcon';
import { MicIcon } from './icons/MicIcon';
import type { Locale, WordPair } from '../types';
import {
  enrichCoachActions,
  extractCoachActions,
  parseCoachSegments,
  type CoachActionId,
} from '../lib/coachMessageFormat';
import {
  buildCoachReviewPairs,
  coachExchangeHasCards,
  mergeWordPairs,
} from '../lib/coachCards';

/** Enrich actions and auto-add create_cards when the turn yields reviewable pairs. */
function finalizeCoachReply(reply: string, userMessage = ''): string {
  const enriched = enrichCoachActions(reply);
  const { text, actions } = extractCoachActions(enriched);
  if (actions.includes('create_cards')) return enriched;
  if (!coachExchangeHasCards(userMessage, text)) return enriched;
  return `${enriched}\n[[action:create_cards]]`;
}

interface ChatScreenProps {
  locale: Locale;
  refreshKey: number;
  isLoggedIn: boolean;
  onAuth: () => void;
  onUpgrade: () => void;
  onOpenScan?: () => void;
  onOpenSettings?: () => void;
  onOpenHome?: () => void;
  onOpenUniverse?: () => void;
  onContinueInGame?: (pairs: WordPair[], thumbnail?: string) => void;
}

function actionLabel(action: CoachActionId, locale: Locale): string {
  switch (action) {
    case 'scan':
      return t('chatActionScan', locale);
    case 'settings':
      return t('chatActionSettings', locale);
    case 'home':
      return t('chatActionHome', locale);
    case 'universe':
      return t('chatActionUniverse', locale);
    case 'continue_chat':
      return t('chatContinueHere', locale);
    case 'continue_game':
      return t('chatContinueGame', locale);
    case 'create_cards':
      return t('chatCreateCards', locale);
    case 'export_word':
      return t('chatExportWord', locale);
    case 'export_pdf':
      return t('chatExportPdf', locale);
    default:
      return action;
  }
}

function CoachTyping() {
  return (
    <p className="chat-bubble chat-bubble--assistant chat-bubble--typing" aria-live="polite">
      <span className="chat-typing" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="sr-only">…</span>
    </p>
  );
}

function CoachBubbleBody({
  content,
  role,
  locale,
  onAction,
}: {
  content: string;
  role: CoachMessage['role'];
  locale: Locale;
  onAction?: (action: CoachActionId, sourceContent?: string) => void;
}) {
  if (role === 'user') return <>{content}</>;
  const { text, actions } = extractCoachActions(content);
  return (
    <>
      {parseCoachSegments(text).map((part, i) =>
        part.type === 'bold' ? <strong key={i}>{part.value}</strong> : <span key={i}>{part.value}</span>,
      )}
      {actions.length > 0 && onAction && (
        <span className="chat-action-row">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              className="chat-action-btn"
              onClick={() => onAction(action, content)}
            >
              {actionLabel(action, locale)}
            </button>
          ))}
        </span>
      )}
    </>
  );
}

function MicWaveform({ level }: { level: number }) {
  const bars = [0.35, 0.55, 0.9, 0.6, 0.4, 0.75, 0.5].map((base, i) => {
    const wave = 0.35 + level * (0.55 + (i % 3) * 0.12) * base;
    return Math.min(1, Math.max(0.18, wave));
  });
  return (
    <div className="chat-waveform" aria-hidden="true">
      {bars.map((h, i) => (
        <span key={i} className="chat-waveform-bar" style={{ transform: `scaleY(${h})` }} />
      ))}
    </div>
  );
}

function CoachComingSoon({ locale }: { locale: Locale }) {
  return (
    <div className="screen tab-screen chat-screen">
      <header className="top-bar">
        <h2 className="screen-title">{t('chatTitle', locale)}</h2>
        <p className="chat-soon-pill">{t('chatComingSoonBadge', locale)}</p>
      </header>
      <main className="chat-soon">
        <p className="chat-soon-title">{t('chatComingSoonTitle', locale)}</p>
        <p className="chat-soon-body">{t('chatComingSoonBody', locale)}</p>
      </main>
    </div>
  );
}

export function ChatScreen(props: ChatScreenProps) {
  if (!isCoachChatEnabled()) {
    return <CoachComingSoon locale={props.locale} />;
  }
  return <ChatScreenLive {...props} />;
}

function ChatScreenLive({
  locale,
  refreshKey,
  isLoggedIn,
  onAuth,
  onUpgrade: _onUpgrade,
  onOpenScan,
  onOpenSettings,
  onOpenHome,
  onOpenUniverse,
  onContinueInGame,
}: ChatScreenProps) {
  void _onUpgrade;
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<CoachConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<CoachConversation | null>(null);
  const [pendingPairs, setPendingPairs] = useState<WordPair[]>([]);
  const [pendingThumb, setPendingThumb] = useState<string | undefined>();
  const [pendingTitle, setPendingTitle] = useState('Fiche jointe (photo du chat)');
  const [pendingAttaches, setPendingAttaches] = useState<
    { id: string; file: File; previewUrl: string; name: string }[]
  >([]);
  const [showJumpDown, setShowJumpDown] = useState(false);
  /** Bumps when cloud sync / focus updates the AI envelope locally. */
  const [usageTick, setUsageTick] = useState(0);
  const [quota, setQuota] = useState<CoachQuota>({
    used: 0,
    limit: getDailyChatLimit(),
    remaining: getDailyChatLimit(),
    plan: 'free',
    maxChars: getChatMaxChars(),
    voiceEnabled: true,
    voiceProvider: 'groq',
  });
  const listRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);
  const stopVoiceRef = useRef<(() => void) | null>(null);
  const cancelVoiceRef = useRef<(() => void) | null>(null);
  const voiceDiscardedRef = useRef(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const firstMessageRef = useRef(true);
  const pendingAttachUrlsRef = useRef<string[]>([]);
  const MAX_PENDING_ATTACHES = 5;

  const maxChars = quota.maxChars ?? getChatMaxChars();
  const voiceOn = quota.voiceEnabled !== false && canRecordCoachVoice();
  const hasPendingAttach = pendingAttaches.length > 0;

  const resizeDraft = () => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxH = Math.min(window.innerHeight * 0.36, 220);
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  };

  useEffect(() => {
    resizeDraft();
  }, [draft, recording]);

  const reloadThread = async (conversationId: string) => {
    const history = await loadCoachMessages(conversationId);
    firstMessageRef.current = history.filter((m) => m.role === 'user').length === 0;
    setMessages(
      history.map((row, i, arr) => {
        if (row.role !== 'assistant') return row;
        let userText = '';
        for (let j = i - 1; j >= 0; j -= 1) {
          if (arr[j]!.role === 'user') {
            userText = arr[j]!.content;
            break;
          }
        }
        return { ...row, content: finalizeCoachReply(row.content, userText) };
      }),
    );
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    void (async () => {
      // Refresh AI % from cloud so phone/PC don't show different bars.
      await pullUserData({ skipStripeSync: true }).catch(() => false);
      if (cancelled) return;
      setUsageTick((n) => n + 1);
      const [nextQuota, active, list] = await Promise.all([
        fetchCoachQuota(),
        ensureActiveConversation(),
        listCoachConversations(),
      ]);
      if (cancelled) return;
      if (nextQuota) setQuota(nextQuota);
      setConversations(list);
      if (active) {
        setActiveConversation(active);
        applyConversationSheet(active.id);
        await reloadThread(active.id);
      } else {
        setActiveConversation(null);
        setMessages([]);
        firstMessageRef.current = true;
        setPendingPairs([]);
        setPendingThumb(undefined);
        setPendingTitle('Fiche jointe (photo du chat)');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, refreshKey]);

  useEffect(() => {
    const bump = () => setUsageTick((n) => n + 1);
    const unsub = onSyncReady(bump);
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      bump();
      if (!isLoggedIn) return;
      void pullUserData({ skipStripeSync: true }).then((ok) => {
        if (ok) bump();
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', bump);
    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', bump);
    };
  }, [isLoggedIn]);

  const updateJumpVisibility = () => {
    const el = listRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = gap < 72;
    stickToBottomRef.current = nearBottom;
    setShowJumpDown(!nearBottom && el.scrollHeight > el.clientHeight + 40);
  };

  const scrollThreadToBottom = (smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    setShowJumpDown(false);
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    if (!stickToBottomRef.current) {
      updateJumpVisibility();
      return;
    }
    scrollThreadToBottom(false);
  }, [messages, busy]);

  useEffect(
    () => () => {
      stopVoiceRef.current?.();
      cancelVoiceRef.current?.();
      pendingAttachUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      pendingAttachUrlsRef.current = [];
    },
    [],
  );

  const clearPendingAttaches = () => {
    pendingAttachUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    pendingAttachUrlsRef.current = [];
    setPendingAttaches([]);
  };

  const removePendingAttach = (id: string) => {
    setPendingAttaches((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        pendingAttachUrlsRef.current = pendingAttachUrlsRef.current.filter(
          (url) => url !== target.previewUrl,
        );
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const queueAttachments = (files: File[]) => {
    setAttachOpen(false);
    if (busy || blocked || files.length === 0) return;
    setPendingAttaches((prev) => {
      const room = Math.max(0, MAX_PENDING_ATTACHES - prev.length);
      if (room === 0) return prev;
      const nextItems = files.slice(0, room).map((file) => {
        const previewUrl = URL.createObjectURL(file);
        pendingAttachUrlsRef.current.push(previewUrl);
        return {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl,
          name: file.name || 'image',
        };
      });
      return [...prev, ...nextItems];
    });
    setError(null);
    window.requestAnimationFrame(() => draftRef.current?.focus());
  };

  void usageTick;
  const aiPct = Math.round(getAiUsageRatio() * 100);
  const aiExhausted = !canSpendAiBudget();
  const noSheets = getHistory().length === 0 && pendingPairs.length === 0;
  const blocked = aiExhausted;

  const pushAssistant = (content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `local-bot-${Date.now()}`, role: 'assistant', content: enrichCoachActions(content) },
    ]);
  };

  const runExport = async (kind: 'word' | 'pdf') => {
    const pairs = pendingPairs.length >= 2 ? pendingPairs : getHistory()[0]?.pairs ?? [];
    if (pairs.length < 2) {
      setError(t('chatExportNeedPairs', locale));
      return;
    }
    if (!canUseSynthesis()) {
      setError(t('chatExportNoSynthesis', locale));
      return;
    }
    setBusy(true);
    setError(null);
    const doc = await generateSynthesis({
      pairs,
      locale,
      mode: 'export',
      title: pendingTitle,
      sheetType: 'vocab',
      thumbnail: pendingThumb,
    });
    if (!doc) {
      setError(t('synthesisError', locale));
      setBusy(false);
      return;
    }
    recordSynthesisUsage();
    if (kind === 'word') downloadSynthesisWord(doc, pendingThumb);
    else printSynthesisPdf(doc, pendingThumb);
    pushAssistant(
      t(kind === 'word' ? 'chatExportWordDone' : 'chatExportPdfDone', locale).replace(
        '{title}',
        doc.title,
      ),
    );
    setBusy(false);
  };

  const runAction = (action: CoachActionId, sourceContent?: string) => {
    if (action === 'scan') onOpenScan?.();
    else if (action === 'settings') onOpenSettings?.();
    else if (action === 'home') onOpenHome?.();
    else if (action === 'universe') onOpenUniverse?.();
    else if (action === 'continue_chat') {
      pushAssistant(t('chatContinueHereAck', locale));
    } else if (action === 'continue_game') {
      if (pendingPairs.length >= 2) {
        onContinueInGame?.(pendingPairs, pendingThumb);
      } else {
        setError(t('chatExportNeedPairs', locale));
      }
    } else if (action === 'create_cards') {
      let userText = '';
      let coachText = sourceContent ?? '';
      if (sourceContent) {
        const idx = messages.findIndex(
          (row) => row.role === 'assistant' && row.content === sourceContent,
        );
        if (idx > 0) {
          for (let i = idx - 1; i >= 0; i -= 1) {
            if (messages[i]!.role === 'user') {
              userText = messages[i]!.content;
              break;
            }
          }
        }
        coachText = sourceContent;
      } else {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          if (messages[i]!.role === 'assistant') {
            coachText = messages[i]!.content;
            for (let j = i - 1; j >= 0; j -= 1) {
              if (messages[j]!.role === 'user') {
                userText = messages[j]!.content;
                break;
              }
            }
            break;
          }
        }
      }
      const extracted = buildCoachReviewPairs(userText, coachText);
      const merged = mergeWordPairs(pendingPairs, extracted);
      if (merged.length === 0) {
        setError(t('chatCreateCardsEmpty', locale));
        return;
      }
      setPendingPairs(merged);
      onContinueInGame?.(merged, pendingThumb);
    } else if (action === 'export_word') void runExport('word');
    else if (action === 'export_pdf') void runExport('pdf');
  };

  const send = async (
    text: string,
    speakReply = false,
    sheet?: { pairs: WordPair[]; title?: string; thumb?: string },
  ) => {
    const message = text.trim();
    if (!message || busy || blocked) return;
    if (message.length > maxChars) {
      setError(t('chatTooLong', locale).replace('{max}', String(maxChars)));
      return;
    }
    const pairsForTurn = sheet?.pairs ?? pendingPairs;
    const titleForTurn = sheet?.title ?? pendingTitle;
    setBusy(true);
    setError(null);
    setDraft('');
    const localId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: localId, role: 'user', content: message }]);

    let conversation = activeConversation;
    let createdThisTurn = false;
    if (!conversation) {
      conversation = await createCoachConversation(titleFromFirstMessage(message));
      createdThisTurn = Boolean(conversation);
      if (conversation) setActiveConversation(conversation);
    }

    if (aiExhausted) {
      setMessages((prev) => [
        ...prev.filter((row) => row.id !== localId),
        { id: `${localId}-user`, role: 'user', content: message },
        {
          id: `${localId}-bot`,
          role: 'assistant',
          content: enrichCoachActions(t('chatAiBudgetReply', locale)),
        },
      ]);
      setBusy(false);
      // Stay in chat — user can open Settings via [[action:settings]] if they want.
      return;
    }

    const isFirst = firstMessageRef.current;
    firstMessageRef.current = false;

    if (conversation && pairsForTurn.length >= 2) {
      saveCoachConversationSheet(conversation.id, {
        title: titleForTurn,
        pairs: pairsForTurn,
        thumb: sheet?.thumb ?? pendingThumb,
      });
    }

    const result = await sendCoachMessage(message, locale, {
      conversationId: conversation?.id,
      pendingPairs: pairsForTurn,
      pendingTitle: titleForTurn,
      isFirstMessage: isFirst,
    });
    if ('error' in result) {
      setMessages((prev) => prev.filter((row) => row.id !== localId));
      firstMessageRef.current = isFirst;
      if (createdThisTurn && conversation) {
        await deleteCoachConversation(conversation.id);
        setActiveConversation(null);
      }
      if (result.quota) setQuota(result.quota);
      if (result.error === 'quota' || result.error === 'plan') {
        // Only treat as AI-envelope block when the local bar is actually full.
        // Legacy Free daily=0 RPC must not kick users to Settings at 0% usage.
        if (!canSpendAiBudget()) {
          setMessages((prev) => [
            ...prev,
            { id: `${localId}-user`, role: 'user', content: message },
            {
              id: `${localId}-bot`,
              role: 'assistant',
              content: enrichCoachActions(t('chatAiBudgetReply', locale)),
            },
          ]);
        } else {
          setError(t('chatError', locale));
        }
        setBusy(false);
        return;
      } else if (result.error === 'rpc') setError(t('chatErrorSql', locale));
      else if (result.error === 'ai') setError(t('chatErrorAi', locale));
      else if (result.error === 'auth') setError(t('chatErrorAuth', locale));
      else setError(t('chatError', locale));
      setBusy(false);
      return;
    }

    if (result.quota) setQuota(result.quota);
    if (conversation) {
      const titled = { ...conversation, title: titleFromFirstMessage(message) };
      setActiveConversation(titled);
      setConversations((prev) => [titled, ...prev.filter((c) => c.id !== titled.id)]);
    }
    const reply = finalizeCoachReply(result.reply, message);
    setMessages((prev) => [
      ...prev.filter((row) => row.id !== localId),
      { id: `${localId}-user`, role: 'user', content: message },
      { id: `${localId}-bot`, role: 'assistant', content: reply },
    ]);
    if (speakReply) {
      const speechLang = locale === 'ar' ? undefined : locale;
      void speakText(reply.replace(/\[\[action:[^\]]+\]\]/gi, '').trim(), speechLang);
    }
    setBusy(false);
  };

  const discardVoice = () => {
    if (!recording) return;
    voiceDiscardedRef.current = true;
    cancelVoiceRef.current?.();
  };

  const toggleVoice = async () => {
    if (busy || blocked) return;
    if (recording) {
      voiceDiscardedRef.current = false;
      stopVoiceRef.current?.();
      return;
    }
    setError(null);
    setRecording(true);
    setMicLevel(0.2);
    voiceDiscardedRef.current = false;
    const session = recordSpeechWithVAD({
      untilStop: true,
      maxMs: 20000,
      onLevel: (level) => setMicLevel(level),
    });
    stopVoiceRef.current = session.stop;
    cancelVoiceRef.current = session.cancel;
    const blob = await session.promise;
    stopVoiceRef.current = null;
    cancelVoiceRef.current = null;
    setRecording(false);
    setMicLevel(0);
    if (voiceDiscardedRef.current) {
      voiceDiscardedRef.current = false;
      return;
    }
    if (!blob) {
      setError(t('chatVoiceError', locale));
      return;
    }
    const transcribed = await transcribeViaServer(blob, locale === 'ar' ? undefined : locale);
    if (!transcribed.text) {
      setError(t('chatVoiceError', locale));
      return;
    }
    await send(transcribed.text.slice(0, maxChars), true);
  };

  const analyzeAttachments = async (files: File[], caption = '') => {
    setAttachOpen(false);
    if (busy || blocked || files.length === 0) return;
    setBusy(true);
    setError(null);
    const localId = `attach-${Date.now()}`;
    const note = caption.trim();
    setMessages((prev) => [
      ...prev,
      { id: localId, role: 'user', content: t('chatAttachAnalyzing', locale) },
    ]);
    try {
      const merged: WordPair[] = [];
      const seen = new Set<string>();
      let thumb: string | undefined;
      for (const file of files) {
        if (!thumb) {
          thumb = await createThumbnail(file, 160).catch(() => undefined);
        }
        const { pairs } = await extractPairsFromImage(file, 'vocab');
        for (const pair of coercePlayablePairs(pairs)) {
          const key = `${pair.term.trim().toLowerCase()}|${pair.definition.trim().toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(pair);
        }
      }
      const playable = coercePlayablePairs(merged);
      if (!canOpenGamePath(playable) || playable.length < 2) {
        setMessages((prev) => prev.filter((row) => row.id !== localId));
        setError(t('chatAttachEmpty', locale));
        setBusy(false);
        return;
      }
      const sheetTitle = 'Fiche jointe (photo du chat)';
      setPendingPairs(playable);
      setPendingThumb(thumb);
      setPendingTitle(sheetTitle);

      if (note) {
        // Drop the analyzing placeholder; send() posts the real user bubble + coach reply.
        setMessages((prev) => prev.filter((row) => row.id !== localId));
        setBusy(false);
        await send(`📷 ${note}`, false, { pairs: playable, title: sheetTitle, thumb });
        return;
      }

      const summary = t('chatAttachReady', locale)
        .replace('{count}', String(playable.length))
        .replace('{sample}', playable.slice(0, 3).map((p) => p.term).join(', '));
      const userLine =
        files.length > 1
          ? `${t('chatAttachSent', locale)} (${files.length})`
          : t('chatAttachSent', locale);
      const botLine = enrichCoachActions(
        `${summary}\n\n[[action:continue_chat]]\n[[action:continue_game]]\n[[action:export_word]]\n[[action:export_pdf]]`,
      );
      let conversation = activeConversation;
      if (!conversation) {
        conversation = await createCoachConversation(titleFromFirstMessage(userLine));
        if (conversation) {
          setActiveConversation(conversation);
          setConversations((prev) => [conversation!, ...prev.filter((c) => c.id !== conversation!.id)]);
        }
      }
      if (conversation) {
        saveCoachConversationSheet(conversation.id, {
          title: sheetTitle,
          pairs: playable,
          thumb,
        });
      }
      await persistCoachExchange(conversation?.id, userLine, botLine);
      setMessages((prev) => [
        ...prev.filter((row) => row.id !== localId),
        { id: `${localId}-user`, role: 'user', content: userLine },
        { id: `${localId}-bot`, role: 'assistant', content: botLine },
      ]);
    } catch {
      setMessages((prev) => prev.filter((row) => row.id !== localId));
      setError(t('chatAttachError', locale));
    }
    setBusy(false);
  };

  const submitComposer = async () => {
    if (busy || blocked || recording) return;
    if (pendingAttaches.length > 0) {
      const files = pendingAttaches.map((item) => item.file);
      const caption = draft.trim();
      clearPendingAttaches();
      setDraft('');
      await analyzeAttachments(files, caption);
      return;
    }
    await send(draft);
  };

  const startNewConversation = () => {
    // Draft only — nothing in history until the first message is sent.
    setHistoryOpen(false);
    setAttachOpen(false);
    clearPendingAttaches();
    setActiveConversation(null);
    setMessages([]);
    firstMessageRef.current = true;
    setPendingPairs([]);
    setPendingThumb(undefined);
    setError(null);
    setShowJumpDown(false);
    stickToBottomRef.current = true;
  };

  const applyConversationSheet = (conversationId: string | null | undefined) => {
    const saved = loadCoachConversationSheet(conversationId);
    if (saved) {
      setPendingPairs(saved.pairs);
      setPendingTitle(saved.title || 'Fiche jointe (photo du chat)');
      setPendingThumb(saved.thumb);
      return;
    }
    setPendingPairs([]);
    setPendingTitle('Fiche jointe (photo du chat)');
    setPendingThumb(undefined);
  };

  const openConversation = async (conv: CoachConversation) => {
    setHistoryOpen(false);
    clearPendingAttaches();
    setActiveConversation(conv);
    applyConversationSheet(conv.id);
    setError(null);
    stickToBottomRef.current = true;
    setShowJumpDown(false);
    await reloadThread(conv.id);
  };

  if (!isLoggedIn) {
    return (
      <div className="screen tab-screen chat-screen">
        <header className="top-bar">
          <h2 className="screen-title">{t('chatTitle', locale)}</h2>
        </header>
        <main className="settings-main scroll-natural">
          <section className="settings-section">
            <p className="stats-login-hint">{t('chatLoginHint', locale)}</p>
            <button type="button" className="btn-primary" onClick={onAuth}>
              {t('connect', locale)}
            </button>
          </section>
        </main>
      </div>
    );
  }

  const headerTitle =
    activeConversation?.title?.trim() ||
    (messages.length > 0 ? t('chatTitle', locale) : t('chatNew', locale));

  return (
    <div className="screen tab-screen chat-screen">
      <header className="top-bar chat-top">
        <h2 className="screen-title chat-top-title" title={headerTitle}>
          {headerTitle}
        </h2>
        <div className="chat-top-actions">
          <button
            type="button"
            className="chat-icon-btn"
            aria-label={t('chatHistory', locale)}
            aria-expanded={historyOpen}
            onClick={() => {
              setAttachOpen(false);
              setHistoryOpen((v) => !v);
              void listCoachConversations().then(setConversations);
            }}
          >
            ☰
          </button>
          <button
            type="button"
            className="chat-icon-btn chat-icon-btn--accent"
            aria-label={t('chatNew', locale)}
            onClick={startNewConversation}
          >
            ✎
          </button>
        </div>
      </header>

      {historyOpen && (
        <div className="chat-history-panel" role="dialog" aria-label={t('chatHistory', locale)}>
          <div className="chat-history-head">
            <p className="chat-history-title">{t('chatHistory', locale)}</p>
            <button type="button" className="btn-secondary btn-sm" onClick={startNewConversation}>
              {t('chatNew', locale)}
            </button>
          </div>
          {conversations.length === 0 ? (
            <p className="chat-history-empty">{t('chatHistoryEmpty', locale)}</p>
          ) : (
            <ul className="chat-history-list">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    type="button"
                    className={`chat-history-item${conv.id === activeConversation?.id ? ' chat-history-item--active' : ''}`}
                    onClick={() => void openConversation(conv)}
                  >
                    {conv.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <main className="chat-main">
        <div className="chat-thread-wrap">
          <div
            className="chat-thread"
            ref={listRef}
            onScroll={updateJumpVisibility}
          >
            {messages.length === 0 && !busy && (
              <p className="chat-empty">{t(noSheets ? 'chatEmptyNew' : 'chatEmpty', locale)}</p>
            )}
            {messages.map((row) => (
              <div key={row.id} className={`chat-bubble chat-bubble--${row.role}`}>
                <CoachBubbleBody content={row.content} role={row.role} locale={locale} onAction={runAction} />
              </div>
            ))}
            {busy && <CoachTyping />}
          </div>
          {showJumpDown && (
            <button
              type="button"
              className="chat-jump-down"
              aria-label={t('chatJumpDown', locale)}
              onClick={() => scrollThreadToBottom(true)}
            >
              <span className="chat-jump-down-blur" aria-hidden="true" />
              <ChatArrowIcon direction="down" size={18} className="chat-jump-down-icon" />
            </button>
          )}
        </div>

        {!historyOpen && (
          <div className="chat-chips">
            {noSheets ? (
              <>
                <button type="button" className="chat-chip" disabled={busy || blocked} onClick={() => void send(t('chatChipScan', locale))}>
                  {t('chatChipScan', locale)}
                </button>
                <button type="button" className="chat-chip" disabled={busy || blocked} onClick={() => void send(t('chatChipNew', locale))}>
                  {t('chatChipNew', locale)}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="chat-chip" disabled={busy || blocked} onClick={() => void send(t('chatChipQuiz', locale))}>
                  {t('chatChipQuiz', locale)}
                </button>
                <button type="button" className="chat-chip" disabled={busy || blocked} onClick={() => void send(t('chatChipReview', locale))}>
                  {t('chatChipReview', locale)}
                </button>
              </>
            )}
          </div>
        )}

        {error && <p className="shop-msg shop-msg--error">{error}</p>}
        {blocked && (
          <button type="button" className="btn-primary" onClick={() => onOpenSettings?.()}>
            {t('upgradeAiBudgetCta', locale)}
          </button>
        )}

        <div className="chat-composer-wrap">
          {attachOpen && (
            <div className="chat-attach-menu" role="menu">
              <button
                type="button"
                className="chat-attach-item"
                role="menuitem"
                onClick={() => cameraRef.current?.click()}
              >
                📸 {t('chatAttachPhoto', locale)}
              </button>
              <button
                type="button"
                className="chat-attach-item"
                role="menuitem"
                onClick={() => fileRef.current?.click()}
              >
                📁 {t('chatAttachFile', locale)}
              </button>
              <button
                type="button"
                className="chat-attach-item"
                role="menuitem"
                disabled={busy || pendingPairs.length < 2}
                onClick={() => void runExport('word')}
              >
                📄 {t('chatExportWord', locale)}
              </button>
              <button
                type="button"
                className="chat-attach-item"
                role="menuitem"
                disabled={busy || pendingPairs.length < 2}
                onClick={() => void runExport('pdf')}
              >
                📑 {t('chatExportPdf', locale)}
              </button>
            </div>
          )}

          {hasPendingAttach && !recording && (
            <div className="chat-attach-preview-list" aria-label={t('chatAttachPending', locale)}>
              {pendingAttaches.map((item) => (
                <div key={item.id} className="chat-attach-preview">
                  <img className="chat-attach-preview-thumb" src={item.previewUrl} alt="" />
                  <div className="chat-attach-preview-meta">
                    <p className="chat-attach-preview-label">{t('chatAttachPending', locale)}</p>
                    <p className="chat-attach-preview-name">{item.name}</p>
                  </div>
                  <button
                    type="button"
                    className="chat-attach-preview-remove"
                    aria-label={t('chatAttachRemove', locale)}
                    disabled={busy || blocked}
                    onClick={() => removePendingAttach(item.id)}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form
            className={`chat-composer chat-composer--gpt${recording ? ' chat-composer--recording' : ''}${draft.includes('\n') || draft.length > 42 || hasPendingAttach ? ' chat-composer--tall' : ''}`}
            onSubmit={(event) => {
              event.preventDefault();
              void submitComposer();
            }}
          >
            {recording ? (
              <button
                type="button"
                className="chat-discard-icon"
                aria-label={t('chatVoiceDiscard', locale)}
                onClick={discardVoice}
              >
                <TrashIcon size={18} />
              </button>
            ) : (
              <button
                type="button"
                className={`chat-plus${attachOpen ? ' chat-plus--open' : ''}`}
                aria-label={t('chatAttach', locale)}
                aria-expanded={attachOpen}
                disabled={busy || blocked}
                onClick={() => {
                  setHistoryOpen(false);
                  setAttachOpen((v) => !v);
                }}
              >
                +
              </button>
            )}

            {recording ? (
              <button type="button" className="chat-input-slot chat-input-slot--wave" onClick={() => void toggleVoice()}>
                <MicWaveform level={micLevel} />
                <span className="chat-listening-label">{t('chatVoiceListening', locale)}</span>
              </button>
            ) : (
              <textarea
                ref={draftRef}
                className="chat-input chat-input--grow"
                rows={1}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value.slice(0, maxChars));
                }}
                onInput={resizeDraft}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if ((draft.trim() || hasPendingAttach) && !busy && !blocked) void submitComposer();
                  }
                }}
                placeholder={t('chatPlaceholder', locale)}
                maxLength={maxChars}
                disabled={busy || blocked}
                enterKeyHint="send"
              />
            )}

            {(draft.trim() || hasPendingAttach) && !recording ? (
              <button type="submit" className="chat-send-icon" disabled={busy || blocked} aria-label={t('chatSend', locale)}>
                <ChatArrowIcon direction="up" size={18} />
              </button>
            ) : (
              voiceOn && (
                <button
                  type="button"
                  className={`chat-mic-icon${recording ? ' chat-mic-icon--on' : ''}`}
                  disabled={busy || blocked}
                  aria-pressed={recording}
                  aria-label={recording ? t('chatVoiceStop', locale) : t('chatVoice', locale)}
                  onClick={() => void toggleVoice()}
                >
                  <MicIcon size={20} />
                </button>
              )
            )}
          </form>

          <p className="chat-quota-line">
            {t('chatAiUsageLine', locale).replace('{pct}', String(aiPct))}
          </p>
        </div>
      </main>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length > 0) queueAttachments(files);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length > 0) queueAttachments(files);
        }}
      />
    </div>
  );
}

function TrashIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.2 4.5h5.6M5 7h14M16.2 7l-.6 11.2a1.8 1.8 0 0 1-1.8 1.7H10.2a1.8 1.8 0 0 1-1.8-1.7L7.8 7M10.2 11v5.2M13.8 11v5.2"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
