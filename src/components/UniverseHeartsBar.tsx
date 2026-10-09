import { useEffect, useState } from 'react';
import {
  formatUniverseRegenCountdown,
  getUniverseHearts,
  msUntilNextUniverseHeart,
  UNIVERSE_MAX_HEARTS,
} from '../lib/universeHearts';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface UniverseHeartsBarProps {
  locale: Locale;
  /** Bumps when a heart was just lost (triggers break anim). */
  breakKey?: number;
  refreshKey?: number;
}

export function UniverseHeartsBar({ locale, breakKey = 0, refreshKey = 0 }: UniverseHeartsBarProps) {
  const [hearts, setHearts] = useState(() => getUniverseHearts().hearts);
  const [countdown, setCountdown] = useState(() => msUntilNextUniverseHeart());
  const [breakingIndex, setBreakingIndex] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => {
      setHearts(getUniverseHearts().hearts);
      setCountdown(msUntilNextUniverseHeart());
    };
    sync();
    const id = window.setInterval(sync, 30_000);
    return () => window.clearInterval(id);
  }, [refreshKey, breakKey]);

  useEffect(() => {
    if (!breakKey) return;
    const state = getUniverseHearts();
    // The heart that just broke is the first empty slot (index === remaining hearts)
    setBreakingIndex(state.hearts);
    const tmr = window.setTimeout(() => setBreakingIndex(null), 700);
    return () => window.clearTimeout(tmr);
  }, [breakKey]);

  const locked = hearts <= 0;
  const regenLabel = formatUniverseRegenCountdown(countdown, locale);

  return (
    <div className={`universe-hearts${locked ? ' universe-hearts--empty' : ''}`} aria-live="polite">
      <div className="universe-hearts-row" role="img" aria-label={t('universeHeartsLabel', locale).replace('{n}', String(hearts))}>
        {Array.from({ length: UNIVERSE_MAX_HEARTS }, (_, i) => {
          const filled = i < hearts;
          const breaking = breakingIndex === i;
          return (
            <span
              key={i}
              className={`universe-heart${filled ? ' universe-heart--full' : ' universe-heart--empty'}${breaking ? ' universe-heart--break' : ''}`}
              aria-hidden="true"
            >
              {filled || breaking ? '❤' : '♡'}
            </span>
          );
        })}
      </div>
      {locked ? (
        <p className="universe-hearts-msg">{t('universeHeartsEmpty', locale).replace('{time}', regenLabel || '…')}</p>
      ) : hearts < UNIVERSE_MAX_HEARTS && regenLabel ? (
        <p className="universe-hearts-msg universe-hearts-msg--soft">
          {t('universeHeartsRegen', locale).replace('{time}', regenLabel)}
        </p>
      ) : (
        <p className="universe-hearts-msg universe-hearts-msg--soft">{t('universeHeartsHint', locale)}</p>
      )}
    </div>
  );
}
