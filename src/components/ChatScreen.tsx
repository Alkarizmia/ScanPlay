import { useEffect, useRef, useState } from 'react';
import {
  fetchCoachQuota,
  loadCoachMessages,
  sendCoachMessage,
  type CoachMessage,
  type CoachQuota,
} from '../lib/coachChat';
import { getHistory } from '../lib/history';
import { getChatMaxChars, getDailyChatLimit } from '../lib/planLimits';
import { isCoachChatEnabled } from '../lib/coachFlag';
import { t } from '../lib/i18n';
import { speakText } from '../lib/speech';
import { canRecordCoachVoice, recordSpeechWithVAD, transcribeViaServer } from '../lib/speechServer';
import { MicIcon } from './icons/MicIcon';
import type { Locale } from '../types';

interface ChatScreenProps {
  locale: Locale;
  refreshKey: number;
  isLoggedIn: boolean;
  onAuth: () => void;
  onUpgrade: () => void;
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

function ChatScreenLive({ locale, refreshKey, isLoggedIn, onAuth, onUpgrade }: ChatScreenProps) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const stopVoiceRef = useRef<(() => void) | null>(null);

  const maxChars = quota.maxChars ?? getChatMaxChars();
  const voiceOn = quota.voiceEnabled !== false && canRecordCoachVoice();

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    void (async () => {
      const [nextQuota, history] = await Promise.all([fetchCoachQuota(), loadCoachMessages()]);
      if (cancelled) return;
      if (nextQuota) setQuota(nextQuota);
      setMessages(history);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, refreshKey]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  useEffect(() => () => stopVoiceRef.current?.(), []);

  const remaining = Math.max(Number(quota.remaining) || 0, 0);
  const used = Number.isFinite(Number(quota.used)) ? Number(quota.used) : 0;
  const limit = Number(quota.limit) || getDailyChatLimit();
  const noSheets = getHistory().length === 0;
  const blocked = !noSheets && remaining <= 0 && used >= limit;

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

    const result = await sendCoachMessage(message, locale);
    if ('error' in result) {
      setMessages((prev) => prev.filter((row) => row.id !== localId));
      if (result.quota) setQuota(result.quota);
      if (result.error === 'quota') setError(t('chatQuotaEmpty', locale));
      else if (result.error === 'rpc') setError(t('chatErrorSql', locale));
      else if (result.error === 'ai') setError(t('chatErrorAi', locale));
      else if (result.error === 'auth') setError(t('chatErrorAuth', locale));
      else setError(t('chatError', locale));
      setBusy(false);
      return;
    }

    if (result.quota) setQuota(result.quota);
    setMessages((prev) => [
      ...prev.filter((row) => row.id !== localId),
      { id: `${localId}-user`, role: 'user', content: message },
      { id: `${localId}-bot`, role: 'assistant', content: result.reply },
    ]);
    if (speakReply) void speakText(result.reply, locale);
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
    const session = recordSpeechWithVAD({ untilStop: true, maxMs: 20000 });
    stopVoiceRef.current = session.stop;
    const blob = await session.promise;
    stopVoiceRef.current = null;
    setRecording(false);
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

  return (
    <div className="screen tab-screen chat-screen">
      <header className="top-bar">
        <h2 className="screen-title">{t('chatTitle', locale)}</h2>
        <p className="chat-quota">
          {noSheets
            ? t('chatQuotaIdle', locale).replace('{limit}', String(limit))
            : t('chatQuota', locale)
                .replace('{remaining}', String(remaining))
                .replace('{limit}', String(limit))}
        </p>
      </header>

      <main className="chat-main">
        <div className="chat-thread" ref={listRef}>
          {messages.length === 0 && !busy && (
            <p className="chat-empty">{t(noSheets ? 'chatEmptyNew' : 'chatEmpty', locale)}</p>
          )}
          {messages.map((row) => (
            <p key={row.id} className={`chat-bubble chat-bubble--${row.role}`}>
              {row.content}
            </p>
          ))}
          {busy && <p className="chat-bubble chat-bubble--assistant chat-bubble--pending">…</p>}
        </div>

        <div className="chat-chips">
          {noSheets ? (
            <>
              <button type="button" className="chat-chip" disabled={busy || blocked} onClick={() => void send(t('chatChipScan', locale))}>
                {t('chatChipScan', locale)}
              </button>
              <button type="button" className="chat-chip" disabled={busy || blocked} onClick={() => void send(t('chatChipNew', locale))}>
                {t('chatChipNew', locale)}
              </button>
              <button type="button" className="chat-chip" disabled={busy || blocked} onClick={() => void send(t('chatChipBoost', locale))}>
                {t('chatChipBoost', locale)}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="chat-chip" disabled={busy || blocked} onClick={() => void send(t('chatChipQuiz', locale))}>
                {t('chatChipQuiz', locale)}
              </button>
              <button type="button" className="chat-chip" disabled={busy || blocked} onClick={() => void send(t('chatChipBoost', locale))}>
                {t('chatChipBoost', locale)}
              </button>
              <button type="button" className="chat-chip" disabled={busy || blocked} onClick={() => void send(t('chatChipReview', locale))}>
                {t('chatChipReview', locale)}
              </button>
            </>
          )}
        </div>

        {error && <p className="shop-msg shop-msg--error">{error}</p>}
        {blocked && (
          <button type="button" className="btn-primary" onClick={onUpgrade}>
            {t('chatUpgradeCta', locale)}
          </button>
        )}

        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          {voiceOn && (
            <button
              type="button"
              className={`chat-mic${recording ? ' chat-mic--on' : ''}`}
              disabled={busy || blocked}
              aria-pressed={recording}
              aria-label={recording ? t('chatVoiceStop', locale) : t('chatVoice', locale)}
              onClick={() => void toggleVoice()}
            >
              <MicIcon size={20} />
            </button>
          )}
          <input
            className="chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, maxChars))}
            placeholder={recording ? t('chatVoiceListening', locale) : t('chatPlaceholder', locale)}
            maxLength={maxChars}
            disabled={busy || blocked || recording}
          />
          <span className="chat-chars">
            {draft.length}/{maxChars}
          </span>
          <button type="submit" className="btn-primary chat-send" disabled={busy || blocked || recording || !draft.trim()}>
            {t('chatSend', locale)}
          </button>
        </form>
      </main>
    </div>
  );
}
