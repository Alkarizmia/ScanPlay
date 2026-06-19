import { t } from '../lib/i18n';
import type { Locale } from '../types';

export function SiteFooter({ locale }: { locale: Locale }) {
  return (
    <footer className="site-footer">
      <a href="/privacy.html" className="site-footer-link">
        {t('privacyOpen', locale)}
      </a>
      <span className="site-footer-sep" aria-hidden="true">
        ·
      </span>
      <a href="mailto:support@scanplay.org" className="site-footer-link">
        support@scanplay.org
      </a>
    </footer>
  );
}
