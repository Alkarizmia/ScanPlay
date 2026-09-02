import { useEffect, type ReactNode } from 'react';

import { LogoWordmark } from '../Logo';
import {
  CameraIcon,
  FlameIcon,
  PathPhoneMock,
  ProgressCardMock,
  QuizPhoneMock,
  SheetMock,
  SparkIcon,
  TrophyIcon,
} from './LandingVisuals';
import { usePassed, useReveal } from './useReveal';
import { trackEvent } from '../../lib/analytics';
import { t } from '../../lib/i18n';
import type { TranslationKey } from '../../lib/i18n';
import type { DeviceProfile } from '../../lib/device';
import type { Locale } from '../../types';

interface LandingPageProps {
  locale: Locale;
  device: DeviceProfile;
  onScanPlay: () => void;
  onAuth: () => void;
}

/**
 * Social proof placeholder. ScanPlay has no collected testimonials yet, so the
 * section stays unrendered rather than showing invented quotes. Fill this array
 * with real ones and the section appears automatically.
 */
interface Testimonial {
  quote: string;
  author: string;
  context: string;
}
const TESTIMONIALS: Testimonial[] = [];

const STEPS: { num: string; title: TranslationKey; body: TranslationKey }[] = [
  { num: '01', title: 'lpStep1Title', body: 'lpStep1Body' },
  { num: '02', title: 'lpStep2Title', body: 'lpStep2Body' },
  { num: '03', title: 'lpStep3Title', body: 'lpStep3Body' },
];

const BENEFITS: { title: TranslationKey; body: TranslationKey }[] = [
  { title: 'lpBenefit1Title', body: 'lpBenefit1Body' },
  { title: 'lpBenefit2Title', body: 'lpBenefit2Body' },
  { title: 'lpBenefit3Title', body: 'lpBenefit3Body' },
];

const FAQ: { q: TranslationKey; a: TranslationKey }[] = [
  { q: 'lpFaq1Q', a: 'lpFaq1A' },
  { q: 'lpFaq2Q', a: 'lpFaq2A' },
  { q: 'lpFaq3Q', a: 'lpFaq3A' },
  { q: 'lpFaq4Q', a: 'lpFaq4A' },
  { q: 'lpFaq5Q', a: 'lpFaq5A' },
  { q: 'lpFaq6Q', a: 'lpFaq6A' },
];

function Section({
  id,
  className = '',
  children,
  labelledBy,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  const { ref, shown } = useReveal<HTMLElement>();
  return (
    <section
      id={id}
      ref={ref}
      aria-labelledby={labelledBy}
      className={`lp-section ${className}${shown ? ' is-in' : ''}`}
    >
      <div className="lp-container">{children}</div>
    </section>
  );
}

export function LandingPage({ locale, device, onScanPlay, onAuth }: LandingPageProps) {
  const isDesktop = device.kind === 'desktop';
  const { ref: heroCtaRef, passed: heroCtaPassed } = usePassed<HTMLDivElement>();

  // The guest app shell locks html/body scrolling for the in-app screens.
  // The landing needs the document to scroll, so flag it only while mounted.
  useEffect(() => {
    document.documentElement.dataset.landing = 'true';
    return () => {
      delete document.documentElement.dataset.landing;
    };
  }, []);

  const scan = (placement: string) => {
    trackEvent('clic_cta_landing', { emplacement: placement });
    onScanPlay();
  };

  const login = () => {
    trackEvent('ouverture_inscription', { etape: 'page_de_garde' });
    onAuth();
  };

  const ctaNote = (
    <p className="lp-cta-note">
      <ShieldIcon />
      {t('lpHeroCtaNote', locale)}
    </p>
  );

  return (
    <div className="screen sp-landing">
      <a className="lp-skip" href="#lp-main">
        {t('lpSkipToContent', locale)}
      </a>

      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <div className="lp-header-brand">
            <LogoWordmark />
          </div>

          {isDesktop && (
            <nav className="lp-nav" aria-label={t('lpNavLabel', locale)}>
              <a href="#comment-ca-marche">{t('lpNavHow', locale)}</a>
              <a href="#le-produit">{t('lpNavProduct', locale)}</a>
              <a href="#questions">{t('lpNavFaq', locale)}</a>
            </nav>
          )}

          <div className="lp-header-actions">
            <button type="button" className="lp-btn lp-btn--ghost" onClick={login}>
              {t('connect', locale)}
            </button>
            {isDesktop && (
              <button
                type="button"
                className="lp-btn lp-btn--primary lp-btn--sm"
                onClick={() => scan('header')}
              >
                {t('lpHeroCta', locale)}
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="lp-main" className="lp-main">
        {/* ---------- HERO ---------- */}
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-container lp-hero-inner">
            <div className="lp-hero-copy">
              <p className="lp-eyebrow">
                <SparkIcon />
                {t('lpHeroEyebrow', locale)}
              </p>

              <h1 id="lp-hero-title" className="lp-hero-title">
                {t('lpHeroTitle', locale)}
              </h1>

              <p className="lp-hero-sub">{t('lpHeroSub', locale)}</p>

              <div className="lp-hero-actions" ref={heroCtaRef}>
                <button
                  type="button"
                  className="lp-btn lp-btn--primary lp-btn--lg lp-btn--block"
                  onClick={() => scan('hero')}
                >
                  <CameraIcon />
                  {t('lpHeroCta', locale)}
                </button>
                {ctaNote}
              </div>

              <ul className="lp-hero-chips">
                <li>{t('lpHeroChip1', locale)}</li>
                <li>{t('lpHeroChip2', locale)}</li>
                <li>{t('lpHeroChip3', locale)}</li>
              </ul>
            </div>

            <div className="lp-hero-visual">
              <p className="sr-only">{t('lpVisualAlt', locale)}</p>
              <div className="lp-transform">
                <SheetMock locale={locale} />
                <span className="lp-transform-arrow" aria-hidden="true">
                  <ArrowIcon />
                  <span>{t('lpVisualScan', locale)}</span>
                </span>
                <div className="lp-transform-phone">
                  <span className="lp-phone-label" aria-hidden="true">
                    {t('lpVisualGame', locale)}
                  </span>
                  <QuizPhoneMock locale={locale} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- HOW IT WORKS ---------- */}
        <Section id="comment-ca-marche" className="lp-section--steps" labelledBy="lp-steps-title">
          <header className="lp-section-head">
            <h2 id="lp-steps-title">{t('lpStepsTitle', locale)}</h2>
            <p>{t('lpStepsSub', locale)}</p>
          </header>

          <ol className="lp-steps">
            {STEPS.map((step) => (
              <li key={step.num} className="lp-step">
                <span className="lp-step-num" aria-hidden="true">
                  {step.num}
                </span>
                <h3>{t(step.title, locale)}</h3>
                <p>{t(step.body, locale)}</p>
              </li>
            ))}
          </ol>

          <div className="lp-section-cta">
            <button
              type="button"
              className="lp-btn lp-btn--primary lp-btn--lg"
              onClick={() => scan('etapes')}
            >
              <CameraIcon />
              {t('lpHeroCta', locale)}
            </button>
            {ctaNote}
          </div>
        </Section>

        {/* ---------- PRODUCT ---------- */}
        <Section id="le-produit" className="lp-section--product" labelledBy="lp-product-title">
          <header className="lp-section-head">
            <h2 id="lp-product-title">{t('lpProductTitle', locale)}</h2>
            <p>{t('lpProductSub', locale)}</p>
          </header>

          <div className="lp-product-grid">
            <div className="lp-product-visual">
              <PathPhoneMock locale={locale} />
            </div>

            <ul className="lp-product-list">
              <li>
                <h3>{t('lpProduct1Title', locale)}</h3>
                <p>{t('lpProduct1Body', locale)}</p>
              </li>
              <li>
                <h3>{t('lpProduct2Title', locale)}</h3>
                <p>{t('lpProduct2Body', locale)}</p>
                <ul className="lp-tags">
                  <li>{t('flashcards', locale)}</li>
                  <li>{t('quiz', locale)}</li>
                  <li>{t('match', locale)}</li>
                  <li>{t('modeType', locale)}</li>
                  <li>{t('modeSpeak', locale)}</li>
                  <li>{t('modeListen', locale)}</li>
                  <li>{t('modeTrueFalse', locale)}</li>
                  <li>{t('modeCloze', locale)}</li>
                  <li>{t('modeTranslate', locale)}</li>
                  <li>{t('modeDictation', locale)}</li>
                  <li>{t('modeListenPick', locale)}</li>
                  <li>{t('modeReorder', locale)}</li>
                </ul>
              </li>
              <li>
                <h3>{t('lpProduct3Title', locale)}</h3>
                <p>{t('lpProduct3Body', locale)}</p>
              </li>
            </ul>
          </div>
        </Section>

        {/* ---------- PROBLEM → SOLUTION ---------- */}
        <Section className="lp-section--problem" labelledBy="lp-problem-title">
          <div className="lp-problem">
            <div className="lp-problem-side">
              <p className="lp-kicker">{t('lpProblemKicker', locale)}</p>
              <h2 id="lp-problem-title">{t('lpProblemTitle', locale)}</h2>
              <p className="lp-problem-body">{t('lpProblemBody', locale)}</p>
            </div>
            <div className="lp-problem-side lp-problem-side--solution">
              <p className="lp-kicker lp-kicker--accent">{t('lpSolutionKicker', locale)}</p>
              <h3>{t('lpSolutionTitle', locale)}</h3>
              <p className="lp-problem-body">{t('lpSolutionBody', locale)}</p>
            </div>
          </div>

          <ul className="lp-benefits">
            {BENEFITS.map((benefit) => (
              <li key={benefit.title}>
                <h3>{t(benefit.title, locale)}</h3>
                <p>{t(benefit.body, locale)}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* ---------- GAMIFICATION ---------- */}
        <Section className="lp-section--game" labelledBy="lp-game-title">
          <div className="lp-game">
            <div className="lp-game-copy">
              <h2 id="lp-game-title">{t('lpGameTitle', locale)}</h2>
              <p className="lp-section-sub">{t('lpGameSub', locale)}</p>

              <ul className="lp-game-list">
                <li>
                  <span className="lp-game-icon" aria-hidden="true">
                    <SparkIcon />
                  </span>
                  <div>
                    <h3>{t('lpGameXpTitle', locale)}</h3>
                    <p>{t('lpGameXpBody', locale)}</p>
                  </div>
                </li>
                <li>
                  <span className="lp-game-icon" aria-hidden="true">
                    <FlameIcon />
                  </span>
                  <div>
                    <h3>{t('lpGameStreakTitle', locale)}</h3>
                    <p>{t('lpGameStreakBody', locale)}</p>
                  </div>
                </li>
                <li>
                  <span className="lp-game-icon" aria-hidden="true">
                    <TrophyIcon />
                  </span>
                  <div>
                    <h3>{t('lpGameAchTitle', locale)}</h3>
                    <p>{t('lpGameAchBody', locale)}</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="lp-game-visual">
              <ProgressCardMock locale={locale} />
            </div>
          </div>
        </Section>

        {/* ---------- SOCIAL PROOF (hidden until real data exists) ---------- */}
        {TESTIMONIALS.length > 0 && (
          <Section className="lp-section--proof" labelledBy="lp-proof-title">
            <header className="lp-section-head">
              <h2 id="lp-proof-title">{t('lpProofTitle', locale)}</h2>
            </header>
            <ul className="lp-proof-grid">
              {TESTIMONIALS.map((item) => (
                <li key={item.author} className="lp-proof-card">
                  <blockquote>{item.quote}</blockquote>
                  <p className="lp-proof-author">
                    <strong>{item.author}</strong>
                    <span>{item.context}</span>
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ---------- FAQ ---------- */}
        <Section id="questions" className="lp-section--faq" labelledBy="lp-faq-title">
          <header className="lp-section-head">
            <h2 id="lp-faq-title">{t('lpFaqTitle', locale)}</h2>
            <p>{t('lpFaqSub', locale)}</p>
          </header>

          <div className="lp-faq">
            {FAQ.map((item) => (
              <details key={item.q} className="lp-faq-item">
                <summary>
                  {t(item.q, locale)}
                  <span className="lp-faq-chevron" aria-hidden="true">
                    <ChevronIcon />
                  </span>
                </summary>
                <div className="lp-faq-answer">
                  <p>{t(item.a, locale)}</p>
                  {item.q === 'lpFaq6Q' && (
                    <a href="/privacy.html" className="lp-inline-link">
                      {t('privacyOpen', locale)}
                    </a>
                  )}
                </div>
              </details>
            ))}
          </div>
        </Section>

        {/* ---------- FINAL CTA ---------- */}
        <Section className="lp-section--final" labelledBy="lp-final-title">
          <div className="lp-final">
            <h2 id="lp-final-title">{t('lpFinalTitle', locale)}</h2>
            <p>{t('lpFinalSub', locale)}</p>
            <button
              type="button"
              className="lp-btn lp-btn--primary lp-btn--lg"
              onClick={() => scan('final')}
            >
              <CameraIcon />
              {t('lpHeroCta', locale)}
            </button>
            {ctaNote}
            <p className="lp-final-login">
              {t('lpFinalHasAccount', locale)}{' '}
              <button type="button" className="lp-inline-link" onClick={login}>
                {t('connect', locale)}
              </button>
            </p>
          </div>
        </Section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-brand">
            <LogoWordmark />
            <p>{t('lpFooterTagline', locale)}</p>
          </div>

          <nav className="lp-footer-nav" aria-label={t('lpFooterNavLabel', locale)}>
            <div>
              <p className="lp-footer-nav-title">{t('lpFooterProduct', locale)}</p>
              <a href="#comment-ca-marche">{t('lpNavHow', locale)}</a>
              <a href="#le-produit">{t('lpNavProduct', locale)}</a>
              <a href="#questions">{t('lpNavFaq', locale)}</a>
            </div>
            <div>
              <p className="lp-footer-nav-title">{t('lpFooterHelp', locale)}</p>
              <a href="mailto:support@scanplay.org">support@scanplay.org</a>
              <a href="/privacy.html">{t('privacyOpen', locale)}</a>
            </div>
          </nav>
        </div>

        <p className="lp-footer-legal">
          © {new Date().getFullYear()} ScanPlay · {t('lpFooterRights', locale)}
        </p>
      </footer>

      {/* ---------- MOBILE STICKY CTA ---------- */}
      {!isDesktop && (
        <div className={`lp-sticky${heroCtaPassed ? ' is-visible' : ''}`}>
          <button
            type="button"
            className="lp-btn lp-btn--primary lp-btn--lg lp-btn--block"
            onClick={() => scan('sticky')}
            tabIndex={heroCtaPassed ? 0 : -1}
            aria-hidden={!heroCtaPassed}
          >
            <CameraIcon size={20} />
            {t('lpHeroCta', locale)}
          </button>
          <p className="lp-sticky-note">{t('lpStickyNote', locale)}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- local icons ---------- */

function ShieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2 4 5.2v6.1c0 5 3.4 9.6 8 10.7 4.6-1.1 8-5.7 8-10.7V5.2L12 2Zm3.8 7.7-4.4 5a1 1 0 0 1-1.5.04L8 12.8a1 1 0 1 1 1.5-1.3l1.2 1.4 3.7-4.2a1 1 0 0 1 1.5 1.3Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
