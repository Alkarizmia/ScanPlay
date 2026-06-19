import { useEffect, useRef, useState } from 'react';
import { AdSenseSlot } from './AdSenseSlot';
import { waitForAdStorageConsent } from '../lib/ads/consent';
import { WEB_REWARDED_VIEW_SECONDS, getAdSenseRewardSlot, isWebRewardedAdLive } from '../lib/ads/config';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface RewardedAdSheetProps {
  open: boolean;
  locale: Locale;
  onClose: () => void;
  onReward: () => void;
}

export function RewardedAdSheet({ open, locale, onClose, onReward }: RewardedAdSheetProps) {
  const [secondsLeft, setSecondsLeft] = useState(WEB_REWARDED_VIEW_SECONDS);
  const [adsReady, setAdsReady] = useState(false);
  const [adFilled, setAdFilled] = useState(false);
  const [adChecked, setAdChecked] = useState(false);
  const slotId = getAdSenseRewardSlot();
  const live = isWebRewardedAdLive();
  const onRewardRef = useRef(onReward);
  const onCloseRef = useRef(onClose);
  onRewardRef.current = onReward;
  onCloseRef.current = onClose;

  const handleFillChange = (filled: boolean) => {
    setAdFilled(filled);
    setAdChecked(true);
  };

  useEffect(() => {
    if (!open) {
      setSecondsLeft(WEB_REWARDED_VIEW_SECONDS);
      setAdsReady(false);
      setAdFilled(false);
      setAdChecked(false);
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (!live) {
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }

    let cancelled = false;
    void waitForAdStorageConsent().then((ok) => {
      if (!cancelled) setAdsReady(ok);
    });

    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow;
    };
  }, [open, live]);

  useEffect(() => {
    if (!open || !live || !adsReady) return;

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

    return () => window.clearInterval(id);
  }, [open, live, adsReady]);

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
            : t('shopAdRewardDone', locale)}
        </p>

        {adsReady && slotId && (
          <AdSenseSlot
            key={`reward-${slotId}-${open}`}
            slotId={slotId}
            format="rectangle"
            label={t('shopAdLabel', locale)}
            consentHint={t('shopAdCmpWait', locale)}
            emptyHint={t('shopAdEmptyFill', locale)}
            onFillChange={handleFillChange}
          />
        )}

        {!adsReady && <p className="rewarded-ad-hint">{t('shopAdCmpWait', locale)}</p>}

        {adsReady && adChecked && !adFilled && (
          <p className="rewarded-ad-empty">{t('shopAdEmptyFill', locale)}</p>
        )}

        {adsReady && secondsLeft > 0 && (
          <div className="rewarded-ad-timer" aria-live="polite">
            {t('shopAdRewardWait', locale).replace('{sec}', String(secondsLeft))}
          </div>
        )}
      </div>
    </div>
  );
}
