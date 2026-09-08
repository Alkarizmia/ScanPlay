import { Mascot } from './Mascot';
import { StreakFlame } from './icons/StreakFlame';
import { LootCoin } from './icons/EconomyIcons';
import { canRestoreStreak, getRestorableStreak, streakRestoreHoursLeft, streakRestorePrice } from '../lib/wallet';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface StreakLostModalProps {
  locale: Locale;
  onClose: () => void;
  onOpenShop?: () => void;
}

function daysLabel(days: number, locale: Locale) {
  const key = days === 1 ? 'streakLostDayOne' : 'streakLostDayMany';
  return t(key, locale).replace('{n}', String(days));
}

export function StreakLostModal({ locale, onClose, onOpenShop }: StreakLostModalProps) {
  const canRestore = canRestoreStreak();
  const lost = getRestorableStreak();
  const showRestore = canRestore && lost > 0 && Boolean(onOpenShop);
  const price = streakRestorePrice(lost);
  const hours = streakRestoreHoursLeft();

  return (
    <div
      className="modal-overlay streak-lost-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-lost-title"
      aria-describedby="streak-lost-lead"
    >
      <div className="modal-card streak-lost-card">
        <Mascot message={t('streakLostMsg', locale)} mood="encouraging" size={52} />

        <span className="streak-lost-mark" aria-hidden="true">
          <StreakFlame lit={false} size={28} />
        </span>

        <h3 id="streak-lost-title" className="modal-title">
          {t('streakLostTitle', locale)}
        </h3>
        <p id="streak-lost-lead" className="streak-lost-restart">
          {t(showRestore ? 'streakLostRestart' : 'streakLostRestartSolo', locale)}
        </p>

        {showRestore && (
          <div className="streak-restore-card">
            <p className="streak-restore-kicker">{t('streakRestoreTitle', locale)}</p>
            <p className="streak-restore-days">{daysLabel(lost, locale)}</p>
            <p className="streak-restore-meta">
              <span className="streak-restore-price">
                <LootCoin size={16} />
                {price}
              </span>
              <span className="streak-restore-time">
                {t('streakRestoreTime', locale).replace('{hours}', String(hours))}
              </span>
            </p>
            <button type="button" className="btn-secondary" onClick={onOpenShop}>
              {t('streakRestoreShop', locale)}
            </button>
          </div>
        )}

        <button type="button" className="btn-primary btn-lg streak-lost-cta" onClick={onClose}>
          {t('streakLostCta', locale)}
        </button>
      </div>
    </div>
  );
}
