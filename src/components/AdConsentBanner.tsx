import { useEffect, useState } from 'react';
import { grantAdConsent, needsAdConsentPrompt } from '../lib/ads/consent';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface AdConsentBannerProps {
  locale: Locale;
  /** Laisse la page de garde visible un instant avant le bandeau. */
  delayMs?: number;
}

export function AdConsentBanner({ locale, delayMs = 0 }: AdConsentBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!needsAdConsentPrompt()) return;
    const id = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  if (!visible) return null;

  const accept = () => {
    grantAdConsent();
    setVisible(false);
  };

  return (
    <div className="ad-consent-banner" role="dialog" aria-labelledby="ad-consent-title">
      <div className="ad-consent-inner">
        <p id="ad-consent-title" className="ad-consent-title">
          {t('shopAdConsentTitle', locale)}
        </p>
        <p className="ad-consent-body">{t('shopAdConsentBody', locale)}</p>
        <button type="button" className="btn-primary ad-consent-btn" onClick={accept}>
          {t('shopAdConsentAccept', locale)}
        </button>
      </div>
    </div>
  );
}
