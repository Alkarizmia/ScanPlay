import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface GuestPlayReadyModalProps {
  locale: Locale;
  onSignup: () => void;
  onLogin: () => void;
}

export function GuestPlayReadyModal({ locale, onSignup, onLogin }: GuestPlayReadyModalProps) {
  useEffect(() => {
    const prev = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'light');
    return () => {
      if (prev) document.documentElement.setAttribute('data-theme', prev);
    };
  }, []);

  return createPortal(
    <div
      className="guest-aha-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-aha-title"
      data-theme="light"
    >
      <div className="guest-aha-backdrop" aria-hidden="true" />
      <div className="modal-card guest-aha-card">
        <h3 id="guest-aha-title" className="modal-title">
          {t('guestAhaTitle', locale)}
        </h3>
        <p className="modal-body guest-aha-body">
          <strong>{t('guestAhaBodyLead', locale)}</strong>{' '}
          {t('guestAhaBodyRest', locale)}
        </p>
        <button type="button" className="btn-primary btn-lg" onClick={onSignup}>
          {t('guestAhaCta', locale)}
        </button>
        <button type="button" className="btn-secondary btn-lg" onClick={onLogin}>
          {t('guestAhaLogin', locale)}
        </button>
      </div>
    </div>,
    document.body,
  );
}
