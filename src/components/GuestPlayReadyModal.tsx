import { createPortal } from 'react-dom';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface GuestPlayReadyModalProps {
  locale: Locale;
  onSignup: () => void;
  onLogin: () => void;
  onClose: () => void;
}

export function GuestPlayReadyModal({ locale, onSignup, onLogin, onClose }: GuestPlayReadyModalProps) {
  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="guest-aha-title">
      <div className="modal-card guest-aha-card">
        <h3 id="guest-aha-title" className="modal-title">
          {t('guestAhaTitle', locale)}
        </h3>
        <p className="modal-body">{t('guestAhaBody', locale)}</p>
        <button type="button" className="btn-primary btn-lg" onClick={onSignup}>
          {t('guestAhaCta', locale)}
        </button>
        <button type="button" className="btn-secondary btn-lg" onClick={onLogin}>
          {t('guestAhaLogin', locale)}
        </button>
        <button type="button" className="btn-ghost guest-aha-later" onClick={onClose}>
          {t('guestAhaLater', locale)}
        </button>
      </div>
    </div>,
    document.body,
  );
}
