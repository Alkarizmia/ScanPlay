import { useEffect, useState, type ReactNode } from 'react';

import { LogoWordmark } from '../Logo';
import { ScanPlayChest } from '../ScanPlayChest';
import {
  CameraIcon,
  FlameIcon,
  LevelRing,
  PathPhoneMock,
  PathRanksMock,
  QuizPhoneMock,
  ProgressCardMock,
  SheetMock,
  SparkIcon,
  TrophyIcon,
} from './LandingVisuals';
import { LanguageMenu } from './LanguageMenu';
import { StepsSwipeDeck } from './StepsSwipeDeck';
import { useOutOfView, useReveal } from './useReveal';
import { trackEvent } from '../../lib/analytics';
import {
  initialLandingLang,
  lt,
  persistLandingLang,
  type LandingCopyKey,
  type LandingLang,
} from '../../lib/landingI18n';
import type { DeviceProfile } from '../../lib/device';
import type { Locale } from '../../types';

interface LandingPageProps {
  locale: Locale;
  device: DeviceProfile;
  onScanPlay: () => void;
  onAuth: () => void;
}

interface Testimonial {
  id: string;
  quote: string;
  author: string;
  context: string;
  rating?: number;
}

function ProofStars({ rating }: { rating: number }) {
  return (
    <p className="lp-proof-stars" aria-label={`${rating} / 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`lp-proof-star${i < rating ? ' is-on' : ''}`}
          style={{ ['--star-i' as string]: String(i) }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 2.4l2.86 6.42 7 .62-5.32 4.66 1.62 6.9L12 17.7 5.84 21l1.62-6.9L2.14 9.44l7-.62L12 2.4z" />
          </svg>
        </span>
      ))}
    </p>
  );
}
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

const BENEFITS: { title: LandingCopyKey }[] = [
  { title: 'lpBenefit1Title' },
  { title: 'lpBenefit2Title' },
  { title: 'lpBenefit3Title' },
];

const FAQ: { q: LandingCopyKey; a: LandingCopyKey }[] = [
  { q: 'lpFaq1Q', a: 'lpFaq1A' },
  { q: 'lpFaq2Q', a: 'lpFaq2A' },
  { q: 'lpFaq3Q', a: 'lpFaq3A' },
  { q: 'lpFaq4Q', a: 'lpFaq4A' },
  { q: 'lpFaq5Q', a: 'lpFaq5A' },
  { q: 'lpFaq6Q', a: 'lpFaq6A' },
];

const GAME_TAGS: LandingCopyKey[] = [
  'lpModeFlashcards',
  'lpModeQuiz',
  'lpModeMatch',
  'lpModeType',
  'lpModeSpeak',
  'lpModeListen',
  'lpModeTrueFalse',
  'lpModeCloze',
  'lpModeTranslate',
  'lpModeDictation',
  'lpModeListenPick',
  'lpModeReorder',
  'lpModeImagePick',
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
  const [lang, setLang] = useState<LandingLang>(initialLandingLang);
  const locale: Locale = lang;
  const { ref: heroCtaRef, outOfView: heroCtaHidden } = useOutOfView<HTMLDivElement>();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  // The guest app shell locks html/body scrolling for the in-app screens.
  // The landing needs the document to scroll, so flag it only while mounted.
  useEffect(() => {
    document.documentElement.dataset.landing = 'true';
    document.documentElement.lang = lang;
    return () => {
      delete document.documentElement.dataset.landing;
    };
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          import.meta.env.DEV ? 'https://scanplay.org/api/testimonial' : '/api/testimonial',
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          items?: {
            id?: string;
            author_name?: string;
            role?: string;
            quote?: string;
            rating?: number;
          }[];
        };
        if (cancelled) return;
        setTestimonials(
          (data.items ?? [])
            .filter((item) => item.quote && item.author_name)
            .map((item, index) => ({
              id: item.id || `${item.author_name}-${index}`,
              quote: String(item.quote),
              author: String(item.author_name),
              context: String(item.role || ''),
              rating: Number(item.rating) || undefined,
            })),
        );
      } catch {
        /* landing stays without proof */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const changeLang = (next: LandingLang) => {
    trackEvent('changement_langue_landing', { langue: next });
    persistLandingLang(next);
    setLang(next);
  };

  const scan = (placement: string) => {
    trackEvent('clic_cta_landing', { emplacement: placement });
    persistLandingLang(lang);
    onScanPlay();
  };

  const login = () => {
    trackEvent('ouverture_inscription', { etape: 'page_de_garde' });
    persistLandingLang(lang);
    onAuth();
  };

  const persistBilling = (cycle: 'monthly' | 'annual') => {
    setBilling(cycle);
    try {
      localStorage.setItem('scanplay-billing', cycle);
    } catch {
      /* private mode */
    }
  };

  const choosePaid = (plan: 'plus' | 'pro') => {
    persistBilling(billing);
    trackEvent('clic_cta_landing', { emplacement: `plans_${plan}` });
    login();
  };

  const paidPrice = (plan: 'plus' | 'pro') =>
    billing === 'annual'
      ? lt(plan === 'plus' ? 'lpPlanPlusMonthEquiv' : 'lpPlanProMonthEquiv', locale)
      : lt(plan === 'plus' ? 'lpPlanPlusPrice' : 'lpPlanProPrice', locale);

  const paidPeriod = lt('lpPlanPeriodMonth', locale);

  const paidYearHint = (plan: 'plus' | 'pro') =>
    lt('lpPlanYearBilled', locale).replace(
      '{price}',
      lt(plan === 'plus' ? 'lpPlanPlusPriceYear' : 'lpPlanProPriceYear', locale),
    );

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
              <a href="#plans">{lt('lpNavPlans', locale)}</a>
              <a href="#questions">{lt('lpNavFaq', locale)}</a>
            </nav>
          )}

          <div className="lp-header-actions">
            <LanguageMenu lang={lang} onChange={changeLang} />
            <button type="button" className="lp-btn lp-btn--ghost" onClick={login}>
              {lt('lpConnect', locale)}
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
          <div className="lp-hero-bg" aria-hidden="true">
            <span className="lp-hero-aurora" />
            <span className="lp-hero-dots" />
          </div>

          <div className="lp-container lp-hero-inner">
            <div className="lp-hero-intro">
              <p className="lp-eyebrow">
                <SparkIcon />
                {lt('lpHeroEyebrow', locale)}
              </p>

              <h1 id="lp-hero-title" className="lp-hero-title">
                {lt('lpHeroTitleStart', locale)}{' '}
                <span className="lp-hero-title-accent">{lt('lpHeroTitleAccent', locale)}</span>
              </h1>
            </div>

            <div className="lp-hero-visual">
              <p className="sr-only">{lt('lpVisualAlt', locale)}</p>
              <div className="lp-transform">
                <SheetMock locale={locale} />
                <div className="lp-transform-phone">
                  <span className="lp-phone-label" aria-hidden="true">
                    {lt('lpVisualGame', locale)}
                  </span>
                  <QuizPhoneMock locale={locale} />
                  <span className="lp-demo-combo" aria-hidden="true">
                    <FlameIcon size={14} />
                    Combo ×3
                  </span>
                </div>
              </div>

              <ol className="lp-hero-steps">
                <li className="lp-hero-step lp-hero-step--1">
                  <CameraIcon size={15} />
                  {lt('lpHeroStep1', locale)}
                </li>
                <li className="lp-hero-step lp-hero-step--2">
                  <SparkIcon />
                  {lt('lpHeroStep2', locale)}
                </li>
                <li className="lp-hero-step lp-hero-step--3">
                  <TrophyIcon />
                  {lt('lpHeroStep3', locale)}
                </li>
              </ol>
            </div>

            <div className="lp-hero-rest">
              <p className="lp-hero-sub">{lt('lpHeroSub', locale)}</p>

              <div className="lp-hero-actions" ref={heroCtaRef}>
                <button
                  type="button"
                  className="lp-btn lp-btn--primary lp-btn--lg lp-btn--block lp-btn--hero"
                  onClick={() => scan('hero')}
                >
                  <CameraIcon />
                  {lt('lpHeroCta', locale)}
                </button>
              </div>

              <ul className="lp-hero-trust">
                {(['lpHeroTrust1', 'lpHeroTrust2', 'lpHeroTrust3'] as const).map((key) => (
                  <li key={key}>
                    <TickIcon />
                    {lt(key, locale)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- HOW IT WORKS ---------- */}
        <Section id="comment-ca-marche" className="lp-section--steps" labelledBy="lp-steps-title">
          <header className="lp-section-head">
            <h2 id="lp-steps-title">{lt('lpStepsTitle', locale)}</h2>
            <p>{lt('lpStepsSub', locale)}</p>
            <p className="lp-steps-diff">{lt('lpStepsDifferentiator', locale)}</p>
          </header>

          <StepsSwipeDeck steps={STEPS} locale={locale} />

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

        {/* ---------- SOCIAL PROOF (after steps — only when approved) ---------- */}
        {testimonials.length > 0 && (
          <Section className="lp-section--proof" labelledBy="lp-proof-title">
            <header className="lp-section-head">
              <h2 id="lp-proof-title">{lt('lpProofTitle', locale)}</h2>
            </header>
            <div
              className="lp-proof-marquee"
              style={{ ['--lp-proof-n' as string]: String(testimonials.length) }}
            >
              <ul className="lp-proof-track">
                {[0, 1, 2].flatMap((copy) =>
                  testimonials.map((item) => (
                    <li key={`${item.id}-${copy}`} className="lp-proof-card" aria-hidden={copy > 0}>
                      {item.rating ? <ProofStars rating={item.rating} /> : null}
                      <blockquote>{item.quote}</blockquote>
                      <p className="lp-proof-author">
                        <span className="lp-proof-avatar" aria-hidden="true">
                          {item.author.slice(0, 1).toUpperCase()}
                        </span>
                        <span>
                          <strong>{item.author}</strong>
                          <span>{item.context}</span>
                        </span>
                      </p>
                    </li>
                  )),
                )}
              </ul>
            </div>
          </Section>
        )}

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
                  {GAME_TAGS.map((key) => (
                    <li key={key}>{lt(key, locale)}</li>
                  ))}
                </ul>
              </li>
              <li>
                <h3>{lt('lpProduct3Title', locale)}</h3>
                <p>{lt('lpProduct3Body', locale)}</p>
              </li>
            </ul>
          </div>
        </Section>

        <Section className="lp-section--ranks" labelledBy="lp-ranks-title">
          <header className="lp-section-head">
            <h2 id="lp-ranks-title">{lt('lpRanksTitle', locale)}</h2>
            <p>{lt('lpRanksSub', locale)}</p>
          </header>
          <PathRanksMock locale={locale} />
        </Section>

        {/* ---------- PROBLEM → SOLUTION (compact) ---------- */}
        <Section className="lp-section--problem" labelledBy="lp-problem-title">
          <div className="lp-contrast">
            <div className="lp-contrast-pane">
              <p className="lp-kicker">{lt('lpProblemKicker', locale)}</p>
              <h2 id="lp-problem-title">{lt('lpProblemTitle', locale)}</h2>
            </div>
            <div className="lp-contrast-pane lp-contrast-pane--solution">
              <p className="lp-kicker lp-kicker--accent">{lt('lpSolutionKicker', locale)}</p>
              <h3>{lt('lpSolutionTitle', locale)}</h3>
            </div>
          </div>

          <ul className="lp-benefit-strip" aria-label={lt('lpSolutionKicker', locale)}>
            {BENEFITS.map((benefit) => (
              <li key={benefit.title}>{lt(benefit.title, locale)}</li>
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
                  <span className="lp-game-mark" aria-hidden="true">
                    <LevelRing level={4} size={36} />
                  </span>
                  <div>
                    <h3>{lt('lpGameXpTitle', locale)}</h3>
                    <p>{lt('lpGameXpBody', locale)}</p>
                  </div>
                </li>
                <li>
                  <span className="lp-game-mark" aria-hidden="true">
                    <FlameIcon size={26} />
                  </span>
                  <div>
                    <h3>{lt('lpGameStreakTitle', locale)}</h3>
                    <p>{lt('lpGameStreakBody', locale)}</p>
                  </div>
                </li>
                <li>
                  <span className="lp-game-mark" aria-hidden="true">
                    <ScanPlayChest size={32} />
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

        <Section id="plans" className="lp-section--plans" labelledBy="lp-plans-title">
          <header className="lp-section-head">
            <h2 id="lp-plans-title">{lt('lpPlansTitle', locale)}</h2>
            <p>{lt('lpPlansSub', locale)}</p>
          </header>

          <div className="lp-billing" role="group" aria-label={lt('lpBillingLabel', locale)}>
            <button
              type="button"
              className={`lp-billing-btn${billing === 'monthly' ? ' is-on' : ''}`}
              aria-pressed={billing === 'monthly'}
              onClick={() => persistBilling('monthly')}
            >
              {lt('lpBillingMonthly', locale)}
            </button>
            <button
              type="button"
              className={`lp-billing-btn${billing === 'annual' ? ' is-on' : ''}`}
              aria-pressed={billing === 'annual'}
              onClick={() => persistBilling('annual')}
            >
              {lt('lpBillingAnnual', locale)}
              <span className="lp-billing-save">{lt('lpBillingSave', locale)}</span>
            </button>
          </div>

          <div className="lp-plans">
            <article className="lp-plan">
              <h3>{lt('lpPlanFreeName', locale)}</h3>
              <p className="lp-plan-price">
                {lt('lpPlanFreePrice', locale)}
                <small>{lt('lpPlanFreePeriod', locale)}</small>
              </p>
              <ul>
                <li>{lt('lpPlanFree1', locale)}</li>
                <li>{lt('lpPlanFree2', locale)}</li>
              </ul>
              <button
                type="button"
                className="lp-btn lp-btn--ghost lp-btn--block"
                onClick={() => scan('plans_free')}
              >
                {lt('lpPlanCtaFree', locale)}
              </button>
            </article>

            <article className="lp-plan lp-plan--plus">
              <p className="lp-plan-badge">{lt('lpPlanPopular', locale)}</p>
              <h3>{lt('lpPlanPlusName', locale)}</h3>
              <p className="lp-plan-price">
                {paidPrice('plus')}
                <small>{paidPeriod}</small>
              </p>
              {billing === 'annual' && <p className="lp-plan-equiv">{paidYearHint('plus')}</p>}
              <ul>
                <li>{lt('lpPlanPlus1', locale)}</li>
                <li>{lt('lpPlanPlus2', locale)}</li>
                <li>{lt('lpPlanPlus3', locale)}</li>
              </ul>
              <button
                type="button"
                className="lp-btn lp-btn--primary lp-btn--block"
                onClick={() => choosePaid('plus')}
              >
                {lt('lpPlanCtaPlus', locale)}
              </button>
            </article>

            <article className="lp-plan">
              <h3>{lt('lpPlanProName', locale)}</h3>
              <p className="lp-plan-price">
                {paidPrice('pro')}
                <small>{paidPeriod}</small>
              </p>
              {billing === 'annual' && <p className="lp-plan-equiv">{paidYearHint('pro')}</p>}
              <ul>
                <li>{lt('lpPlanPro1', locale)}</li>
                <li>{lt('lpPlanPro2', locale)}</li>
                <li>{lt('lpPlanPro3', locale)}</li>
                <li>{lt('lpPlanPro4', locale)}</li>
              </ul>
              <button
                type="button"
                className="lp-btn lp-btn--ghost lp-btn--block"
                onClick={() => choosePaid('pro')}
              >
                {lt('lpPlanCtaPro', locale)}
              </button>
            </article>
          </div>
          <p className="lp-plans-note">{lt('lpPlanFootnote', locale)}</p>
        </Section>

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
                      {lt('lpPrivacy', locale)}
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
                {lt('lpConnect', locale)}
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
              <a href="#plans">{lt('lpNavPlans', locale)}</a>
              <a href="#questions">{lt('lpNavFaq', locale)}</a>
            </div>
            <div>
              <p className="lp-footer-nav-title">{lt('lpFooterHelp', locale)}</p>
              <a href="mailto:support@scanplay.org">support@scanplay.org</a>
              <a href="/privacy.html">{lt('lpPrivacy', locale)}</a>
              <a href="/terms.html">{lt('lpTerms', locale)}</a>
            </div>
          </nav>
        </div>

        <p className="lp-footer-legal">
          © {new Date().getFullYear()} ScanPlay · {lt('lpFooterRights', locale)}
        </p>
      </footer>

      {/* ---------- MOBILE STICKY CTA ---------- */}
      {!isDesktop && (
        <div className={`lp-sticky${heroCtaHidden ? ' is-visible' : ''}`}>
          <button
            type="button"
            className="lp-btn lp-btn--primary lp-btn--lg lp-btn--block"
            onClick={() => scan('sticky')}
            tabIndex={heroCtaHidden ? 0 : -1}
            aria-hidden={!heroCtaHidden}
          >
            <CameraIcon size={20} />
            {lt('lpHeroCta', locale)}
          </button>
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

function TickIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="3"
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
