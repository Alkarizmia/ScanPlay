import { PixCompanion } from './PixCompanion';
import { canGuestScan } from '../lib/guestTrial';
import { isLoggedIn } from '../lib/auth';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

type GuestScanBannerVariant = 'default' | 'compact' | 'mobile';

interface GuestScanBannerProps {
  locale: Locale;
  onAuth?: () => void;
  compact?: boolean;
  variant?: GuestScanBannerVariant;
  className?: string;
}

export function GuestScanBanner({
  locale,
  onAuth,
  compact = false,
  variant = 'default',
  className = '',
}: GuestScanBannerProps) {
  if (isLoggedIn()) return null;

  const available = canGuestScan();
  const isMobile = variant === 'mobile';
  const isCompact = compact || variant === 'compact';
  const showBody = isMobile || !isCompact;
  const pixSize = isMobile ? 80 : isCompact ? 56 : 68;

  const bannerClass = [
    'guest-scan-banner',
    available ? 'guest-scan-banner--available' : 'guest-scan-banner--used',
    isMobile ? 'guest-scan-banner--mobile' : '',
    isCompact && !isMobile ? 'guest-scan-banner--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (available) {
    return (
      <div className={bannerClass} role="status">
        <div className="guest-scan-banner-glow" aria-hidden="true" />
        <div className="guest-scan-banner-inner">
          <div className="guest-scan-banner-pix" aria-hidden="true">
            <PixCompanion mood="happy" size={pixSize} animate />
          </div>
          <div className="guest-scan-banner-copy">
            <span className="guest-scan-badge">{t('guestScanBadge', locale)}</span>
            <p className="guest-scan-banner-title">{t('guestScanBannerTitle', locale)}</p>
            {showBody && <p className="guest-scan-banner-body">{t('guestScanBannerBody', locale)}</p>}
            <p className="guest-scan-banner-foot guest-scan-banner-foot--prominent">
              {t('guestScanBannerFoot', locale)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={bannerClass} role="status">
      <div className="guest-scan-banner-inner">
        <div className="guest-scan-banner-pix" aria-hidden="true">
          <PixCompanion mood="sad" size={isMobile ? 72 : isCompact ? 52 : 60} />
        </div>
        <div className="guest-scan-banner-copy">
          <p className="guest-scan-banner-title">{t('guestScanBannerUsedTitle', locale)}</p>
          {showBody && <p className="guest-scan-banner-body">{t('guestScanBannerUsedBody', locale)}</p>}
        </div>
      </div>
      {onAuth && (
        <button type="button" className="btn-primary guest-scan-banner-cta" onClick={onAuth}>
          {t('connect', locale)}
        </button>
      )}
    </div>
  );
}
