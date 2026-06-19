import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface GoldReplayConfirmModalProps {
  locale: Locale;
  onConfirm: () => void;
  onCancel: () => void;
}

export function GoldReplayConfirmModal({ locale, onConfirm, onCancel }: GoldReplayConfirmModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="gold-replay-title">
      <div className="modal-card">
        <h3 id="gold-replay-title" className="modal-title">
          {t('goldReplayConfirmTitle', locale)}
        </h3>
        <p className="modal-body">{t('goldReplayConfirmMsg', locale)}</p>
        <button type="button" className="btn-primary btn-lg" onClick={onConfirm}>
          {t('goldReplayConfirmYes', locale)}
        </button>
        <button type="button" className="btn-secondary btn-lg" onClick={onCancel}>
          {t('goldReplayConfirmNo', locale)}
        </button>
      </div>
    </div>
  );
}
