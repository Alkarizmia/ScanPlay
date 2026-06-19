import { useEffect, useState } from 'react';
import { claimDailyChest, type ChestReward } from '../lib/shop';
import { vibrate } from '../lib/haptics';
import { playSound } from '../lib/sounds';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

const TAPS_TO_OPEN = 3;

interface DailyChestOverlayProps {
  open: boolean;
  locale: Locale;
  onClose: () => void;
  onOpened: (reward: ChestReward) => void;
}

export function DailyChestOverlay({ open, locale, onClose, onOpened }: DailyChestOverlayProps) {
  const [taps, setTaps] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [reward, setReward] = useState<ChestReward | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!open) {
      setTaps(0);
      setShaking(false);
      setReward(null);
      setRevealed(false);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const tapsLeft = Math.max(0, TAPS_TO_OPEN - taps);

  const handleTap = () => {
    if (revealed) return;

    const next = taps + 1;
    setTaps(next);
    setShaking(true);
    playSound('tap');
    vibrate([12, 30, 18]);

    window.setTimeout(() => setShaking(false), 420);

    if (next < TAPS_TO_OPEN) return;

    const result = claimDailyChest();
    if (!result.ok) {
      onClose();
      return;
    }

    setReward(result.reward);
    setRevealed(true);
    onOpened(result.reward);
    playSound('levelUp');
    vibrate([20, 60, 20, 60, 30]);
  };

  return (
    <div className="daily-chest-backdrop" role="presentation" onClick={revealed ? onClose : undefined}>
      <div
        className={`daily-chest-stage${revealed ? ' daily-chest-stage--revealed' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {!revealed && (
          <p className="daily-chest-hint">
            {tapsLeft > 0
              ? t('chestTapHint', locale).replace('{left}', String(tapsLeft))
              : t('chestTapOpen', locale)}
          </p>
        )}

        <button
          type="button"
          className={`daily-chest-gift${shaking ? ' daily-chest-gift--shake' : ''}${revealed ? ' daily-chest-gift--open' : ''}`}
          onClick={handleTap}
          disabled={revealed}
          aria-label={t('shopOpenChest', locale)}
        >
          <span className="daily-chest-gift-emoji" aria-hidden="true">
            🎁
          </span>
          {revealed && reward && (
            <span className="daily-chest-reveal" aria-live="polite">
              <RewardDisplay reward={reward} locale={locale} />
            </span>
          )}
        </button>

        {revealed && (
          <>
            <p className="daily-chest-opened-msg">{t('chestOpened', locale)}</p>
            <button type="button" className="btn-primary btn-lg daily-chest-collect" onClick={onClose}>
              {t('chestCollect', locale)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function RewardDisplay({ reward, locale }: { reward: ChestReward; locale: Locale }) {
  if (reward.type === 'coins') {
    return (
      <span className="daily-chest-reward-coins">
        <span className="daily-chest-coin-icon" aria-hidden="true">
          🪙
        </span>
        <span className="daily-chest-coin-amount">+{reward.amount}</span>
      </span>
    );
  }
  if (reward.type === 'xp') {
    return (
      <span className="daily-chest-reward-other">
        <span className="daily-chest-reward-icon">✨</span>
        <span>+{reward.amount} XP</span>
      </span>
    );
  }
  if (reward.type === 'xp_potion') {
    return (
      <span className="daily-chest-reward-other">
        <span className="daily-chest-reward-icon">⚗️</span>
        <span>{t('chestRewardPotion', locale)}</span>
      </span>
    );
  }
  return (
    <span className="daily-chest-reward-other">
      <span className="daily-chest-reward-icon">{reward.achievement.icon}</span>
      <span>{t(reward.achievement.nameKey, locale)}</span>
    </span>
  );
}
