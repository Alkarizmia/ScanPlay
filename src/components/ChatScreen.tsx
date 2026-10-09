import { useEffect, useRef, useState } from 'react';
import {
  createCoachConversation,
  deleteCoachConversation,
  ensureActiveConversation,
  fetchCoachQuota,
  listCoachConversations,
  loadCoachMessages,
  persistCoachExchange,
  sendCoachMessage,
  titleFromFirstMessage,
  type CoachConversation,
  type CoachMessage,
  type CoachQuota,
} from '../lib/coachChat';
import { getHistory } from '../lib/history';
import { getChatMaxChars, getDailyChatLimit, getPlan } from '../lib/planLimits';
import { isCoachChatEnabled } from '../lib/coachFlag';
import { t } from '../lib/i18n';
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

interface ChatScreenProps {
  locale: Locale;
  refreshKey: number;
  isLoggedIn: boolean;
  onAuth: () => void;
  onUpgrade: () => void;
  onOpenScan?: () => void;
  onOpenSettings?: () => void;
  onOpenHome?: () => void;
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
    case 'continue_chat':
      return t('chatContinueHere', locale);
    case 'continue_game':
      return t('chatContinueGame', locale);
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
  onAction?: (action: CoachActionId) => void;
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
            <button key={action} type="button" className="chat-action-btn" onClick={() => onAction(action)}>
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
  onUpgrade,
  onOpenScan,
  onOpenSettings,
  onOpenHome,
  onContinueInGame,
}: ChatScreenProps) {
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
  const [pendingTitle, setPendingTitle] = useState('Fiche du chat');
  const [showJumpDown, setShowJumpDown] = useState(false);
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
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const firstMessageRef = useRef(true);

  const maxChars = quota.maxChars ?? getChatMaxChars();
  const voiceOn = quota.voiceEnabled !== false && canRecordCoachVoice();

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
      history.map((row) =>
        row.role === 'assistant' ? { ...row, content: enrichCoachActions(row.content) } : row,
      ),
    );
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    void (async () => {
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
        await reloadThread(active.id);
      } else {
        setActiveConversation(null);
        setMessages([]);
        firstMessageRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, refreshKey]);

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

  useEffect(() => () => stopVoiceRef.current?.(), []);

  const limit = Number(quota.limit) || getDailyChatLimit();
  const used = Math.max(0, Number.isFinite(Number(quota.used)) ? Number(quota.used) : 0);
  const remaining =
    used === 0 && limit > 0
      ? limit
      : Math.max(
          0,
          Math.min(
            limit,
            Number.isFinite(Number(quota.remaining)) ? Number(quota.remaining) : limit - used,
          ),
        );
  const noSheets = getHistory().length === 0 && pendingPairs.length === 0;
  const freeLocked = getPlan() === 'free' || getDailyChatLimit() <= 0;
  const blocked = !freeLocked && !noSheets && remaining <= 0 && used >= limit;

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

  const runAction = (action: CoachActionId) => {
    if (action === 'scan') onOpenScan?.();
    else if (action === 'settings') onOpenSettings?.();
    else if (action === 'home') onOpenHome?.();
    else if (action === 'continue_chat') {
      pushAssistant(t('chatContinueHereAck', locale));
    } else if (action === 'continue_game') {
      if (pendingPairs.length >= 2) {
        onContinueInGame?.(pendingPairs, pendingThumb);
      } else {
        setError(t('chatExportNeedPairs', locale));
      }
    } else if (action === 'export_word') void runExport('word');
    else if (action === 'export_pdf') void runExport('pdf');
  };

  const send = async (text: string, speakReply = false) => {
    const message = text.trim();
    if (!message || busy || blocked) return;
    if (message.length > maxChars) {
      setError(t('chatTooLong', locale).replace('{max}', String(maxChars)));
      return;
    }
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

    if (freeLocked) {
      setMessages((prev) => [
        ...prev.filter((row) => row.id !== localId),
        { id: `${localId}-user`, role: 'user', content: message },
        {
          id: `${localId}-bot`,
          role: 'assistant',
          content: enrichCoachActions(t('chatFreeLockedReply', locale)),
        },
      ]);
      setBusy(false);
      return;
    }

    const isFirst = firstMessageRef.current;
    firstMessageRef.current = false;

    const result = await sendCoachMessage(message, locale, {
      conversationId: conversation?.id,
      pendingPairs,
      pendingTitle,
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
      if (result.error === 'quota') setError(t('chatQuotaEmpty', locale));
      else if (result.error === 'plan') {
        setMessages((prev) => [
          ...prev,
          { id: `${localId}-user`, role: 'user', content: message },
          {
            id: `${localId}-bot`,
            role: 'assistant',
            content: enrichCoachActions(t('chatFreeLockedReply', locale)),
          },
        ]);
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
    const reply = enrichCoachActions(result.reply);
    setMessages((prev) => [
      ...prev.filter((row) => row.id !== localId),
      { id: `${localId}-user`, role: 'user', content: message },
      { id: `${localId}-bot`, role: 'assistant', content: reply },
    ]);
    if (speakReply) void speakText(reply.replace(/\[\[action:[^\]]+\]\]/gi, '').trim(), locale);
    setBusy(false);
  };

  const toggleVoice = async () => {
    if (busy || blocked) return;
    if (recording) {
      stopVoiceRef.current?.();
      return;
    }
    setError(null);
    setRecording(true);
    setMicLevel(0.2);
    const session = recordSpeechWithVAD({
      untilStop: true,
      maxMs: 20000,
      onLevel: (level) => setMicLevel(level),
    });
    stopVoiceRef.current = session.stop;
    const blob = await session.promise;
    stopVoiceRef.current = null;
    setRecording(false);
    setMicLevel(0);
    if (!blob) {
      setError(t('chatVoiceError', locale));
      return;
    }
    const transcribed = await transcribeViaServer(blob, locale);
    if (!transcribed.text) {
      setError(t('chatVoiceError', locale));
      return;
    }
    await send(transcribed.text.slice(0, maxChars), true);
  };

  const analyzeAttachment = async (file: File) => {
    setAttachOpen(false);
    if (busy || blocked) return;
    setBusy(true);
    setError(null);
    const localId = `attach-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: localId, role: 'user', content: t('chatAttachAnalyzing', locale) },
    ]);
    try {
      const thumb = await createThumbnail(file, 160).catch(() => undefined);
      const { pairs } = await extractPairsFromImage(file, 'vocab');
      const playable = coercePlayablePairs(pairs);
      if (!canOpenGamePath(playable) || playable.length < 2) {
        setMessages((prev) => prev.filter((row) => row.id !== localId));
        setError(t('chatAttachEmpty', locale));
        setBusy(false);
        return;
      }
      setPendingPairs(playable);
      setPendingThumb(thumb);
      setPendingTitle(playable[0]?.term?.slice(0, 40) || 'Fiche du chat');
      const summary = t('chatAttachReady', locale)
        .replace('{count}', String(playable.length))
        .replace('{sample}', playable.slice(0, 3).map((p) => p.term).join(', '));
      const userLine = t('chatAttachSent', locale);
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

  const startNewConversation = () => {
    // Draft only — nothing in history until the first message is sent.
    setHistoryOpen(false);
    setAttachOpen(false);
    setActiveConversation(null);
    setMessages([]);
    firstMessageRef.current = true;
    setPendingPairs([]);
    setPendingThumb(undefined);
    setError(null);
    setShowJumpDown(false);
    stickToBottomRef.current = true;
  };

  const openConversation = async (conv: CoachConversation) => {
    setHistoryOpen(false);
    setActiveConversation(conv);
    setPendingPairs([]);
    setPendingThumb(undefined);
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
        {(blocked || freeLocked) && (
          <button type="button" className="btn-primary" onClick={onUpgrade}>
            {t('chatUpgradeCta', locale)}
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

          <form
            className={`chat-composer chat-composer--gpt${recording ? ' chat-composer--recording' : ''}${draft.includes('\n') || draft.length > 42 ? ' chat-composer--tall' : ''}`}
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
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
                    if (draft.trim() && !busy && !blocked) void send(draft);
                  }
                }}
                placeholder={t('chatPlaceholder', locale)}
                maxLength={maxChars}
                disabled={busy || blocked}
                enterKeyHint="send"
              />
            )}

            {draft.trim() && !recording ? (
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

          <p className="chat-quota-line" title={freeLocked ? t('chatFreeQuotaHint', locale) : undefined}>
            {freeLocked
              ? t('chatFreeQuotaHint', locale)
              : t('chatQuota', locale).replace('{remaining}', String(remaining)).replace('{limit}', String(limit))}
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
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void analyzeAttachment(file);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void analyzeAttachment(file);
        }}
      />
    </div>
  );
}
