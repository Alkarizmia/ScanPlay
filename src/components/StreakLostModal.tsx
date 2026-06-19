import { Mascot } from './Mascot';
import { canRestoreStreak, getRestorableStreak, streakRestoreHoursLeft, streakRestorePrice } from '../lib/wallet';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface StreakLostModalProps {
  locale: Locale;
  onClose: () => void;
  onOpenShop?: () => void;
}

export function StreakLostModal({ locale, onClose, onOpenShop }: StreakLostModalProps) {
  const canRestore = canRestoreStreak();
  const lost = getRestorableStreak();
  const price = streakRestorePrice(lost);

  return (
    <div className="modal-overlay streak-lost-modal" role="dialog" aria-modal="true">
      <div className="modal-card">
        <Mascot message={t('streakLostMsg', locale)} mood="sad" size={64} />
        <span className="streak-lost-flame" aria-hidden="true">
          💨
        </span>
        <h3 className="modal-title">{t('streakLostTitle', locale)}</h3>
        <p className="streak-lost-restart">{t('streakLostRestart', locale)}</p>
        {canRestore && lost > 0 && onOpenShop && (
          <p className="streak-restore-offer">
            {t('streakRestoreOffer', locale)
              .replace('{days}', String(lost))
              .replace('{price}', String(price))
              .replace('{hours}', String(streakRestoreHoursLeft()))}
          </p>
        )}
        {canRestore && onOpenShop && (
          <button type="button" className="btn-secondary btn-lg" onClick={onOpenShop}>
            {t('streakRestoreShop', locale)}
          </button>
        )}
        <button type="button" className="btn-primary btn-lg" onClick={onClose}>
          {t('streakLostCta', locale)}
        </button>
      </div>
    </div>
  );
}
