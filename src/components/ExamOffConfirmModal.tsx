import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface ExamOffConfirmModalProps {
  locale: Locale;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExamOffConfirmModal({ locale, onConfirm, onCancel }: ExamOffConfirmModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="exam-off-title">
      <div className="modal-card">
        <h3 id="exam-off-title" className="modal-title">
          {t('examOffConfirmTitle', locale)}
        </h3>
        <p className="modal-body">{t('examOffConfirmMsg', locale)}</p>
        <button type="button" className="btn-primary btn-lg" onClick={onConfirm}>
          {t('examOffConfirmYes', locale)}
        </button>
        <button type="button" className="btn-secondary btn-lg" onClick={onCancel}>
          {t('examOffConfirmNo', locale)}
        </button>
      </div>
    </div>
  );
}
