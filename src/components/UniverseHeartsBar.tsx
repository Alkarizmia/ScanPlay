import { useEffect, useState } from 'react';
import {
  formatUniverseRegenCountdown,
  getUniverseHeartCap,
  getUniverseHearts,
  hasInfiniteUniverseHearts,
  msUntilNextUniverseHeart,
} from '../lib/universeHearts';
import { usePlan } from '../hooks/usePlan';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface UniverseHeartsBarProps {
  locale: Locale;
  /** Bumps when a heart was just lost (triggers break anim). */
  breakKey?: number;
  refreshKey?: number;
}

export function UniverseHeartsBar({ locale, breakKey = 0, refreshKey = 0 }: UniverseHeartsBarProps) {
  const plan = usePlan(refreshKey);
  const infinite = hasInfiniteUniverseHearts(plan);
  const cap = getUniverseHeartCap(plan);
  const displayCap = infinite ? 5 : Math.min(5, Number.isFinite(cap) ? cap : 3);
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
  }, [refreshKey, breakKey, plan]);

  useEffect(() => {
    if (!breakKey || infinite) return;
    const state = getUniverseHearts();
    setBreakingIndex(state.hearts);
    const tmr = window.setTimeout(() => setBreakingIndex(null), 700);
    return () => window.clearTimeout(tmr);
  }, [breakKey, infinite]);

  if (infinite) {
    return (
      <div className="universe-hearts" aria-live="polite">
        <div className="universe-hearts-row" role="img" aria-label={t('universeHeartsInfinite', locale)}>
          <span className="universe-heart universe-heart--full universe-heart--infinite" aria-hidden="true">
            ❤ ∞
          </span>
        </div>
        <p className="universe-hearts-msg universe-hearts-msg--soft">{t('universeHeartsInfinite', locale)}</p>
      </div>
    );
  }

  const locked = hearts <= 0;
  const regenLabel = formatUniverseRegenCountdown(countdown, locale);

  return (
    <div className={`universe-hearts${locked ? ' universe-hearts--empty' : ''}`} aria-live="polite">
      <div className="universe-hearts-row" role="img" aria-label={t('universeHeartsLabel', locale).replace('{n}', String(hearts))}>
        {Array.from({ length: displayCap }, (_, i) => {
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
      ) : hearts < displayCap && regenLabel ? (
        <p className="universe-hearts-msg universe-hearts-msg--soft">
          {t('universeHeartsRegen', locale).replace('{time}', regenLabel)}
        </p>
      ) : (
        <p className="universe-hearts-msg universe-hearts-msg--soft">{t('universeHeartsHint', locale)}</p>
      )}
    </div>
  );
}
