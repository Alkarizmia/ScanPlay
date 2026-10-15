import { useEffect, useRef, useState } from 'react';
import { WEB_REWARDED_VIEW_SECONDS } from '../lib/ads/config';
import { t } from '../lib/i18n';
import { AD_REWARD_COINS } from '../lib/wallet';
import type { Locale } from '../types';

interface RewardedAdSheetProps {
  open: boolean;
  locale: Locale;
  onClose: () => void;
  onReward: () => void;
}

/**
 * Attente locale avant crédit ScanCoins.
 * Pas d’unité AdSense ici (politique : pas de pubs Google sur écran sans contenu éditeur).
 */
export function RewardedAdSheet({ open, locale, onClose, onReward }: RewardedAdSheetProps) {
  const [secondsLeft, setSecondsLeft] = useState(WEB_REWARDED_VIEW_SECONDS);
  const onRewardRef = useRef(onReward);
  const onCloseRef = useRef(onClose);
  onRewardRef.current = onReward;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      setSecondsLeft(WEB_REWARDED_VIEW_SECONDS);
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    setSecondsLeft(WEB_REWARDED_VIEW_SECONDS);
    let remaining = WEB_REWARDED_VIEW_SECONDS;
    const id = window.setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(id);
        onRewardRef.current();
        onCloseRef.current();
      }
    }, 1000);

    return () => {
      window.clearInterval(id);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="rewarded-ad-backdrop" role="presentation" onClick={onClose}>
      <div
        className="rewarded-ad-sheet scroll-natural"
        role="dialog"
        aria-labelledby="rewarded-ad-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="rewarded-ad-close icon-btn" onClick={onClose} aria-label={t('back', locale)}>
          ✕
        </button>

        <h3 id="rewarded-ad-title" className="rewarded-ad-title">
          {t('shopAdRewardTitle', locale)}
        </h3>

        <p className="rewarded-ad-hint">
          {secondsLeft > 0
            ? t('shopAdRewardHint', locale).replace('{sec}', String(secondsLeft))
            : t('shopAdRewardDone', locale).replace('{coins}', String(AD_REWARD_COINS))}
        </p>

        {secondsLeft > 0 && (
          <div className="rewarded-ad-timer" aria-live="polite">
            {t('shopAdRewardWait', locale).replace('{sec}', String(secondsLeft))}
          </div>
        )}
      </div>
    </div>
  );
}
