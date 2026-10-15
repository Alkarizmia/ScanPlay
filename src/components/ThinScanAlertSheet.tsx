import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface ThinScanAlertSheetProps {
  locale: Locale;
  onRetry: () => void;
  onContinue: () => void;
}

export function ThinScanAlertSheet({ locale, onRetry, onContinue }: ThinScanAlertSheetProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="thin-scan-title">
      <div className="modal-card">
        <h3 id="thin-scan-title" className="modal-title">
          {t('thinScanTitle', locale)}
        </h3>
        <p className="modal-body">{t('thinScanMsg', locale)}</p>
        <button type="button" className="btn-primary btn-lg" onClick={onRetry}>
          {t('thinScanRetry', locale)}
        </button>
        <button type="button" className="btn-secondary btn-lg" onClick={onContinue}>
          {t('thinScanContinue', locale)}
        </button>
      </div>
    </div>
  );
}
