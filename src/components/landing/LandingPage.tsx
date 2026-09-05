import { useEffect, useMemo, type ReactNode } from 'react';

import { LogoWordmark } from '../Logo';
import {
  CameraIcon,
  FlameIcon,
  PathPhoneMock,
  QuizPhoneMock,
  ProgressCardMock,
  SheetMock,
  SparkIcon,
  TrophyIcon,
} from './LandingVisuals';
import { usePassed, useReveal } from './useReveal';
import { trackEvent } from '../../lib/analytics';
import { t } from '../../lib/i18n';
import { landingLangFromNavigator, lt, type LandingCopyKey } from '../../lib/landingI18n';
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

const STEPS: {
  num: string;
  title: LandingCopyKey;
  body: LandingCopyKey;
  icon: typeof CameraIcon;
}[] = [
  { num: '01', title: 'lpStep1Title', body: 'lpStep1Body', icon: CameraIcon },
  { num: '02', title: 'lpStep2Title', body: 'lpStep2Body', icon: SparkIcon },
  { num: '03', title: 'lpStep3Title', body: 'lpStep3Body', icon: TrophyIcon },
];

const BENEFITS: { title: LandingCopyKey; body: LandingCopyKey }[] = [
  { title: 'lpBenefit1Title', body: 'lpBenefit1Body' },
  { title: 'lpBenefit2Title', body: 'lpBenefit2Body' },
  { title: 'lpBenefit3Title', body: 'lpBenefit3Body' },
];

const WHY: { title: LandingCopyKey; body: LandingCopyKey }[] = [
  { title: 'lpWhy1Title', body: 'lpWhy1Body' },
  { title: 'lpWhy2Title', body: 'lpWhy2Body' },
  { title: 'lpWhy3Title', body: 'lpWhy3Body' },
];

const FAQ: { q: LandingCopyKey; a: LandingCopyKey }[] = [
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

export function LandingPage({ locale: _appLocale, device, onScanPlay, onAuth }: LandingPageProps) {
  const isDesktop = device.kind === 'desktop';
  const lang = useMemo(() => landingLangFromNavigator(), []);
  const locale: Locale = lang;
  const { ref: heroCtaRef, passed: heroCtaPassed } = usePassed<HTMLDivElement>();

  // The guest app shell locks html/body scrolling for the in-app screens.
  // The landing needs the document to scroll, so flag it only while mounted.
  useEffect(() => {
    document.documentElement.dataset.landing = 'true';
    document.documentElement.lang = lang;
    return () => {
      delete document.documentElement.dataset.landing;
    };
  }, [lang]);

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
      {lt('lpHeroCtaNote', locale)}
    </p>
  );

  return (
    <div className="screen sp-landing" lang={lang}>
      <a className="lp-skip" href="#lp-main">
        {lt('lpSkipToContent', locale)}
      </a>

      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <div className="lp-header-brand">
            <LogoWordmark />
          </div>

          {isDesktop && (
            <nav className="lp-nav" aria-label={lt('lpNavLabel', locale)}>
              <a href="#comment-ca-marche">{lt('lpNavHow', locale)}</a>
              <a href="#le-produit">{lt('lpNavProduct', locale)}</a>
              <a href="#questions">{lt('lpNavFaq', locale)}</a>
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
                {lt('lpHeroCta', locale)}
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="lp-main" className="lp-main">
        {/* ---------- HERO ---------- */}
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-container lp-hero-inner">
            <div className="lp-hero-intro">
              <p className="lp-eyebrow">
                <SparkIcon />
                {lt('lpHeroEyebrow', locale)}
              </p>

              <h1 id="lp-hero-title" className="lp-hero-title">
                {lt('lpHeroTitle', locale)}
              </h1>
            </div>

            <div className="lp-hero-visual">
              <p className="sr-only">{lt('lpVisualAlt', locale)}</p>
              <div className="lp-transform">
                <SheetMock locale={locale} />
                <span className="lp-transform-arrow" aria-hidden="true">
                  <ArrowIcon />
                  <span>{lt('lpVisualScan', locale)}</span>
                </span>
                <div className="lp-transform-phone">
                  <span className="lp-phone-label" aria-hidden="true">
                    {lt('lpVisualGame', locale)}
                  </span>
                  <QuizPhoneMock locale={locale} />
                </div>
              </div>
            </div>

            <div className="lp-hero-rest">
              <p className="lp-hero-sub">{lt('lpHeroSub', locale)}</p>

              <div className="lp-hero-actions" ref={heroCtaRef}>
                <button
                  type="button"
                  className="lp-btn lp-btn--primary lp-btn--lg lp-btn--block"
                  onClick={() => scan('hero')}
                >
                  <CameraIcon />
                  {lt('lpHeroCta', locale)}
                </button>
                {ctaNote}
              </div>

              <ul className="lp-hero-chips">
                <li>{lt('lpHeroChip1', locale)}</li>
                <li>{lt('lpHeroChip2', locale)}</li>
                <li>{lt('lpHeroChip3', locale)}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- HOW IT WORKS ---------- */}
        <Section id="comment-ca-marche" className="lp-section--steps" labelledBy="lp-steps-title">
          <header className="lp-section-head">
            <h2 id="lp-steps-title">{lt('lpStepsTitle', locale)}</h2>
            <p>{lt('lpStepsSub', locale)}</p>
          </header>

          <ol className="lp-steps">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.num} className="lp-step">
                  <span className="lp-step-mark" aria-hidden="true">
                    <span className="lp-step-icon">
                      <Icon />
                    </span>
                    <span className="lp-step-num">{step.num}</span>
                  </span>
                  <h3>{lt(step.title, locale)}</h3>
                  <p>{lt(step.body, locale)}</p>
                </li>
              );
            })}
          </ol>

          <div className="lp-section-cta">
            <button
              type="button"
              className="lp-btn lp-btn--primary lp-btn--lg"
              onClick={() => scan('etapes')}
            >
              <CameraIcon />
              {lt('lpHeroCta', locale)}
            </button>
            {ctaNote}
          </div>
        </Section>

        {/* ---------- PRODUCT ---------- */}
        <Section id="le-produit" className="lp-section--product" labelledBy="lp-product-title">
          <header className="lp-section-head">
            <h2 id="lp-product-title">{lt('lpProductTitle', locale)}</h2>
            <p>{lt('lpProductSub', locale)}</p>
          </header>

          <div className="lp-product-grid">
            <div className="lp-product-visual">
              <PathPhoneMock locale={locale} />
            </div>

            <ul className="lp-product-list">
              <li>
                <h3>{lt('lpProduct1Title', locale)}</h3>
                <p>{lt('lpProduct1Body', locale)}</p>
              </li>
              <li>
                <h3>{lt('lpProduct2Title', locale)}</h3>
                <p>{lt('lpProduct2Body', locale)}</p>
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
                  <li>{t('modeImagePick', locale)}</li>
                </ul>
              </li>
              <li>
                <h3>{lt('lpProduct3Title', locale)}</h3>
                <p>{lt('lpProduct3Body', locale)}</p>
              </li>
            </ul>
          </div>
        </Section>

        {/* ---------- PROBLEM → SOLUTION ---------- */}
        <Section className="lp-section--problem" labelledBy="lp-problem-title">
          <div className="lp-problem">
            <div className="lp-problem-side">
              <p className="lp-kicker">{lt('lpProblemKicker', locale)}</p>
              <h2 id="lp-problem-title">{lt('lpProblemTitle', locale)}</h2>
              <p className="lp-problem-body">{lt('lpProblemBody', locale)}</p>
            </div>
            <div className="lp-problem-side lp-problem-side--solution">
              <p className="lp-kicker lp-kicker--accent">{lt('lpSolutionKicker', locale)}</p>
              <h3>{lt('lpSolutionTitle', locale)}</h3>
              <p className="lp-problem-body">{lt('lpSolutionBody', locale)}</p>
            </div>
          </div>

          <ul className="lp-benefits">
            {BENEFITS.map((benefit) => (
              <li key={benefit.title}>
                <h3>{lt(benefit.title, locale)}</h3>
                <p>{lt(benefit.body, locale)}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section className="lp-section--why" labelledBy="lp-why-title">
          <h2 id="lp-why-title" className="lp-why-title">
            {lt('lpWhyTitle', locale)}
          </h2>
          <ul className="lp-why-list">
            {WHY.map((item) => (
              <li key={item.title}>
                <h3>{lt(item.title, locale)}</h3>
                <p>{lt(item.body, locale)}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* ---------- GAMIFICATION ---------- */}
        <Section className="lp-section--game" labelledBy="lp-game-title">
          <div className="lp-game">
            <div className="lp-game-copy">
              <h2 id="lp-game-title">{lt('lpGameTitle', locale)}</h2>
              <p className="lp-section-sub">{lt('lpGameSub', locale)}</p>

              <ul className="lp-game-list">
                <li>
                  <span className="lp-game-icon" aria-hidden="true">
                    <SparkIcon />
                  </span>
                  <div>
                    <h3>{lt('lpGameXpTitle', locale)}</h3>
                    <p>{lt('lpGameXpBody', locale)}</p>
                  </div>
                </li>
                <li>
                  <span className="lp-game-icon" aria-hidden="true">
                    <FlameIcon size={22} />
                  </span>
                  <div>
                    <h3>{lt('lpGameStreakTitle', locale)}</h3>
                    <p>{lt('lpGameStreakBody', locale)}</p>
                  </div>
                </li>
                <li>
                  <span className="lp-game-icon" aria-hidden="true">
                    <TrophyIcon />
                  </span>
                  <div>
                    <h3>{lt('lpGameAchTitle', locale)}</h3>
                    <p>{lt('lpGameAchBody', locale)}</p>
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
              <h2 id="lp-proof-title">{lt('lpProofTitle', locale)}</h2>
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
            <h2 id="lp-faq-title">{lt('lpFaqTitle', locale)}</h2>
            <p>{lt('lpFaqSub', locale)}</p>
          </header>

          <div className="lp-faq">
            {FAQ.map((item) => (
              <details key={item.q} className="lp-faq-item">
                <summary>
                  {lt(item.q, locale)}
                  <span className="lp-faq-chevron" aria-hidden="true">
                    <ChevronIcon />
                  </span>
                </summary>
                <div className="lp-faq-answer">
                  <p>{lt(item.a, locale)}</p>
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
            <h2 id="lp-final-title">{lt('lpFinalTitle', locale)}</h2>
            <p>{lt('lpFinalSub', locale)}</p>
            <button
              type="button"
              className="lp-btn lp-btn--primary lp-btn--lg"
              onClick={() => scan('final')}
            >
              <CameraIcon />
              {lt('lpHeroCta', locale)}
            </button>
            {ctaNote}
            <p className="lp-final-login">
              {lt('lpFinalHasAccount', locale)}{' '}
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
            <p>{lt('lpFooterTagline', locale)}</p>
          </div>

          <nav className="lp-footer-nav" aria-label={lt('lpFooterNavLabel', locale)}>
            <div>
              <p className="lp-footer-nav-title">{lt('lpFooterProduct', locale)}</p>
              <a href="#comment-ca-marche">{lt('lpNavHow', locale)}</a>
              <a href="#le-produit">{lt('lpNavProduct', locale)}</a>
              <a href="#questions">{lt('lpNavFaq', locale)}</a>
            </div>
            <div>
              <p className="lp-footer-nav-title">{lt('lpFooterHelp', locale)}</p>
              <a href="mailto:support@scanplay.org">support@scanplay.org</a>
              <a href="/privacy.html">{t('privacyOpen', locale)}</a>
            </div>
          </nav>
        </div>

        <p className="lp-footer-legal">
          © {new Date().getFullYear()} ScanPlay · {lt('lpFooterRights', locale)}
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
            {lt('lpHeroCta', locale)}
          </button>
          <p className="lp-sticky-note">{lt('lpStickyNote', locale)}</p>
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
