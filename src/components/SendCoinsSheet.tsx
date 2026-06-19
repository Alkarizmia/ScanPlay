import { useCallback, useRef, useState } from 'react';
import { sendCoinsToFriend } from '../lib/social/coinTransfer';
import { getCoins } from '../lib/wallet';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

const HOLD_MS = 1600;

interface SendCoinsSheetProps {
  locale: Locale;
  friendName: string;
  friendUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function SendCoinsSheet({
  locale,
  friendName,
  friendUserId,
  onClose,
  onSuccess,
}: SendCoinsSheetProps) {
  const [amount, setAmount] = useState('10');
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef(0);

  const parsed = Number(amount);
  const validAmount = Number.isFinite(parsed) && parsed >= 1 && parsed <= 9999;
  const maxCoins = getCoins();

  const cancelHold = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setHolding(false);
    setProgress(0);
  }, []);

  const completeSend = useCallback(async () => {
    cancelHold();
    if (!validAmount) return;
    setSending(true);
    setError(null);
    const result = await sendCoinsToFriend(friendUserId, parsed);
    setSending(false);
    if (!result.ok) {
      if (result.reason === 'insufficient') setError(t('shopNotEnoughCoins', locale));
      else if (result.reason === 'not_friends') setError(t('sendCoinsNotFriend', locale));
      else setError(t('sendCoinsError', locale));
      return;
    }
    onSuccess();
    onClose();
  }, [cancelHold, validAmount, friendUserId, parsed, locale, onSuccess, onClose]);

  const startHold = () => {
    if (!validAmount || parsed > maxCoins || sending) return;
    setError(null);
    setHolding(true);
    startRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - startRef.current) / HOLD_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        void completeSend();
      }
    }, 40);
  };

  return (
    <div className="send-coins-sheet" role="dialog" aria-labelledby="send-coins-title">
      <h3 id="send-coins-title" className="send-coins-title">
        {t('sendCoinsTitle', locale)}
      </h3>
      <p className="send-coins-sub">{t('sendCoinsTo', locale).replace('{name}', friendName)}</p>
      <p className="send-coins-balance">
        {t('coins', locale)}: 🪙 {maxCoins}
      </p>

      <label className="field-label" htmlFor="send-coins-amount">
        {t('sendCoinsAmount', locale)}
      </label>
      <input
        id="send-coins-amount"
        type="number"
        min={1}
        max={9999}
        className="field-input"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={sending || holding}
      />

      {error && <p className="send-coins-error">{error}</p>}

      <button
        type="button"
        className={`btn-primary btn-lg send-coins-hold ${holding ? 'send-coins-hold--active' : ''}`}
        disabled={!validAmount || parsed > maxCoins || sending}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
      >
        <span className="send-coins-hold-label">
          {sending ? t('sendCoinsSending', locale) : t('sendCoinsHold', locale)}
        </span>
        {holding && <span className="send-coins-hold-bar" style={{ width: `${progress}%` }} />}
      </button>

      <button type="button" className="btn-ghost" onClick={onClose} disabled={sending}>
        {t('back', locale)}
      </button>
    </div>
  );
}
