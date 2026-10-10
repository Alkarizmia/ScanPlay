import { useEffect, useState } from 'react';
import {
  formatUniverseRegenCountdown,
  msUntilNextUniverseHeart,
  UNIVERSE_MAX_HEARTS,
} from '../lib/universeHearts';
import { t } from '../lib/i18n';
import type { Locale } from '../types';
import { ScanPlayMascot } from './mascot/ScanPlayMascot';
import { playSound } from '../lib/sounds';

interface UniverseOutOfHeartsProps {
  locale: Locale;
  onBack: () => void;
}

/** Full-screen game beat when Univers lives are empty — not a system error. */
export function UniverseOutOfHearts({ locale, onBack }: UniverseOutOfHeartsProps) {
  const [countdown, setCountdown] = useState(() => msUntilNextUniverseHeart());

  useEffect(() => {
    const sync = () => setCountdown(msUntilNextUniverseHeart());
    sync();
    const id = window.setInterval(sync, 15_000);
    return () => window.clearInterval(id);
  }, []);

  const regenLabel = formatUniverseRegenCountdown(countdown, locale) || '…';

  return (
    <div className="universe-out-of-hearts" role="status">
      <div className="universe-out-of-hearts-bg" aria-hidden="true">
        <span className="universe-out-of-hearts-orb universe-out-of-hearts-orb--a" />
        <span className="universe-out-of-hearts-orb universe-out-of-hearts-orb--b" />
        <span className="universe-out-of-hearts-orb universe-out-of-hearts-orb--c" />
      </div>

      <div className="universe-out-of-hearts-panel">
        <div className="universe-out-of-hearts-mascot" aria-hidden="true">
          <ScanPlayMascot expression="sad" size={132} idle preferAsset />
        </div>

        <div
          className="universe-out-of-hearts-lives"
          role="img"
          aria-label={t('universeHeartsLabel', locale).replace('{n}', '0')}
        >
          {Array.from({ length: UNIVERSE_MAX_HEARTS }, (_, i) => (
            <span key={i} className="universe-out-of-hearts-heart" aria-hidden="true">
              ♡
            </span>
          ))}
        </div>

        <h2 className="universe-out-of-hearts-title">{t('universeOutOfHeartsTitle', locale)}</h2>
        <p className="universe-out-of-hearts-sub">
          {t('universeHeartsEmpty', locale).replace('{time}', regenLabel)}
        </p>
        <p className="universe-out-of-hearts-hint">{t('universeOutOfHeartsHint', locale)}</p>

        <button
          type="button"
          className="btn-primary btn-lg universe-out-of-hearts-cta"
          onClick={() => {
            playSound('tap');
            onBack();
          }}
        >
          {t('universeOutOfHeartsBack', locale)}
        </button>
      </div>
    </div>
  );
}
