import { BackIcon } from './icons/BackIcon';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface PixUniverseScreenProps {
  locale: Locale;
  onBack: () => void;
}

/** Store-like shell for Pix courses — content comes later. */
export function PixUniverseScreen({ locale, onBack }: PixUniverseScreenProps) {
  return (
    <div className="screen flow-screen pix-universe-screen">
      <div className="import-ambient" aria-hidden="true">
        <span className="import-ambient-orb import-ambient-orb--a" />
        <span className="import-ambient-orb import-ambient-orb--b" />
        <span className="import-ambient-orb import-ambient-orb--c" />
        <span className="import-ambient-sheen" />
      </div>

      <header className="top-bar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back', locale)}>
          <BackIcon />
        </button>
        <h2 className="screen-title">{t('pixUniverseTitle', locale)}</h2>
        <span className="top-spacer" />
      </header>

      <main className="pix-universe-main scroll-natural">
        <section className="pix-universe-hero">
          <p className="pix-universe-kicker">{t('pixUniverseKicker', locale)}</p>
          <h3 className="pix-universe-headline">{t('pixUniverseHeadline', locale)}</h3>
          <p className="pix-universe-sub">{t('pixUniverseSub', locale)}</p>
        </section>

        <section className="pix-universe-store" aria-label={t('pixUniverseTitle', locale)}>
          <div className="pix-universe-empty">
            <span className="pix-universe-empty-icon" aria-hidden="true">
              🌌
            </span>
            <p className="pix-universe-empty-title">{t('pixUniverseEmptyTitle', locale)}</p>
            <p className="pix-universe-empty-body">{t('pixUniverseEmptyBody', locale)}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
