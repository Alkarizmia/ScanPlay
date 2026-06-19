import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface StreakClaimFlybyProps {
  locale: Locale;
  streak: number;
  pulseKey: number;
}

export function StreakClaimFlyby({ locale, streak, pulseKey }: StreakClaimFlybyProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pulseKey <= 0) return;
    setVisible(true);
    const hide = window.setTimeout(() => setVisible(false), 1400);
    return () => window.clearTimeout(hide);
  }, [pulseKey]);

  if (!visible) return null;

  return createPortal(
    <div className="streak-claim-flyby" role="status" aria-live="polite">
      <div className="streak-claim-anchor">
        <span className="streak-claim-flame" aria-hidden="true">
          🔥
        </span>
        <span className="streak-claim-plus" aria-hidden="true">
          +1
        </span>
      </div>
      <p className="streak-claim-caption">
        {t('streakClaimCaption', locale).replace('{count}', String(streak))}
      </p>
    </div>,
    document.body,
  );
}
