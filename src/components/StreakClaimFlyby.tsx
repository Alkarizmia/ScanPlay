import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { StreakFlame } from './icons/StreakFlame';
import { ScanPlayMascot } from './mascot/ScanPlayMascot';
import { getGamification, getLevel } from '../lib/gamification';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface StreakClaimFlybyProps {
  locale: Locale;
  streak: number;
  pulseKey: number;
}

const SHOW_MS = 2200;

export function StreakClaimFlyby({ locale, streak, pulseKey }: StreakClaimFlybyProps) {
  const [visible, setVisible] = useState(false);
  const level = getLevel(getGamification().xp);

  useEffect(() => {
    if (pulseKey <= 0) return;
    setVisible(true);
    const hide = window.setTimeout(() => setVisible(false), SHOW_MS);
    return () => window.clearTimeout(hide);
  }, [pulseKey]);

  if (!visible) return null;

  return createPortal(
    <div className="streak-claim-flyby" role="status" aria-live="polite">
      <div className="streak-claim-stage">
        <div className="streak-claim-pix" aria-hidden="true">
          <ScanPlayMascot expression="streak" size={56} idle={false} celebrate level={level} />
        </div>
        <div className="streak-claim-anchor">
          <span className="streak-claim-burst" aria-hidden="true" />
          <span className="streak-claim-flame" aria-hidden="true">
            <StreakFlame lit size={32} />
          </span>
          <span className="streak-claim-plus" aria-hidden="true">
            +1
          </span>
        </div>
      </div>
      <p className="streak-claim-caption">
        {t('streakClaimCaption', locale).replace('{count}', String(streak))}
      </p>
    </div>,
    document.body,
  );
}
