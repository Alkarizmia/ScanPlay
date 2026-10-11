import { useEffect, useMemo, useState } from 'react';
import { BillingCycleToggle } from './BillingCycleToggle';
import { BackIcon } from './icons/BackIcon';
import { usePlan } from '../hooks/usePlan';
import { isLoggedIn } from '../lib/auth';
import { t, type TranslationKey } from '../lib/i18n';
import {
  getBillingCycle,
  isPaidPlan,
  PLAN_LIMITS,
  planMonthlyEquivalent,
  planPrice,
  setBillingCycle,
  setPlan,
} from '../lib/planLimits';
import { PLAN_HEART_TIER, type HeartTierLabel } from '../lib/planUsage';
import {
  isStripeCheckoutEnabled,
  openStripePortal,
  refreshPlanFromStripe,
  startStripeCheckout,
  stripeErrorMessage,
} from '../lib/stripeCheckout';
import { canCheckoutPlan } from '../lib/subscription';
import type { BillingCycle, Locale, Plan } from '../types';

interface PricingScreenProps {
  locale: Locale;
  refreshKey?: number;
  onBack: () => void;
  onSelect: () => void;
  onAuth?: () => void;
  onToast?: (message: string) => void;
}

const PLANS: Plan[] = ['free', 'plus', 'pro', 'max'];

const EXCLUSIVE_PERKS: Record<Plan, TranslationKey[]> = {
  free: ['compareHistory', 'compareReplay'],
  plus: ['planPerkStatus', 'planPerkHeartsRegen', 'planPerkBannerChromatic', 'planPerkSpaced', 'planPerkStats'],
  pro: [
    'planPerkStatus',
    'planPerkHeartsInfinite',
    'planPerkBannerChromatic',
    'planPerkExam',
    'planPerkShare',
  ],
  max: [
    'planPerkVerified',
    'planPerkHeartsInfinite',
    'planPerkBannerChromatic',
    'planPerkPriority',
    'planPerkExam',
  ],
};

const TAGLINE_KEY: Record<Exclude<Plan, 'free'>, TranslationKey> = {
  plus: 'planPlusTagline',
  pro: 'planProTagline',
  max: 'planMaxTagline',
};

type CompareRow = {
  labelKey: TranslationKey;
  free: string;
  plus: string;
  pro: string;
  max: string;
};

function heartLabel(tier: HeartTierLabel, locale: Locale): string {
  if (tier === '3') return '3';
  if (tier === '5regen') return `5 · ${t('heartsRegenFast', locale)}`;
  return '∞';
}

function buildRows(locale: Locale): CompareRow[] {
  return [
    {
      labelKey: 'compareHearts',
      free: heartLabel(PLAN_HEART_TIER.free, locale),
      plus: heartLabel(PLAN_HEART_TIER.plus, locale),
      pro: heartLabel(PLAN_HEART_TIER.pro, locale),
      max: heartLabel(PLAN_HEART_TIER.max, locale),
    },
    {
      labelKey: 'comparePath',
      free: String(PLAN_LIMITS.free.pathSteps),
      plus: String(PLAN_LIMITS.plus.pathSteps),
      pro: String(PLAN_LIMITS.pro.pathSteps),
      max: String(PLAN_LIMITS.max.pathSteps),
    },
    {
      labelKey: 'compareHistory',
      free: `${PLAN_LIMITS.free.historyMax}`,
      plus: '∞',
      pro: '∞',
      max: '∞',
    },
    {
      labelKey: 'compareReplay',
      free: `${PLAN_LIMITS.free.historyReplay}`,
      plus: `${PLAN_LIMITS.plus.historyReplay}`,
      pro: `${PLAN_LIMITS.pro.historyReplay}`,
      max: `${PLAN_LIMITS.max.historyReplay}`,
    },
    { labelKey: 'compareSpaced', free: '·', plus: '✓', pro: '✓', max: '✓' },
    { labelKey: 'compareStats', free: '·', plus: '✓', pro: '✓', max: '✓' },
    { labelKey: 'compareExam', free: '·', plus: '·', pro: '✓', max: '✓' },
    { labelKey: 'compareShare', free: '·', plus: '·', pro: '✓', max: '✓' },
    { labelKey: 'compareStatus', free: '·', plus: '✓', pro: '✓', max: '✓✓' },
  ];
}

function planTitle(plan: Plan, locale: Locale) {
  if (plan === 'free') return t('planFree', locale);
  if (plan === 'plus') return t('planPlus', locale);
  if (plan === 'max') return t('planMax', locale);
  return t('planPro', locale);
}

export function PricingScreen({ locale, refreshKey = 0, onBack, onSelect, onAuth, onToast }: PricingScreenProps) {
  const current = usePlan(refreshKey);
  const [billingCycle, setBillingCycleState] = useState<BillingCycle>(() => getBillingCycle());
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const rows = useMemo(() => buildRows(locale), [locale]);

  useEffect(() => {
    if (!isLoggedIn() || !isStripeCheckoutEnabled()) return;
    void refreshPlanFromStripe();
  }, [refreshKey]);

  const paidPlans = useMemo<Plan[]>(() => {
    if (current === 'max') return ['max', 'pro', 'plus'];
    if (current === 'pro') return ['pro', 'max', 'plus'];
    return ['plus', 'pro', 'max'];
  }, [current]);

  const handleBillingCycle = (cycle: BillingCycle) => {
    setBillingCycleState(cycle);
    setBillingCycle(cycle);
  };

  const select = async (plan: Plan) => {
    setBillingCycle(billingCycle);

    if (plan === 'free') {
      return;
    }

    if (isStripeCheckoutEnabled()) {
      if (!isLoggedIn()) {
        onAuth?.();
        return;
      }
      if (!canCheckoutPlan(current, plan)) {
        onToast?.(t('subscriptionUpgradeBlocked', locale));
        return;
      }
      try {
        setCheckoutLoading(true);
        await startStripeCheckout(plan, billingCycle);
      } catch (err) {
        const code = err instanceof Error ? err.message : 'stripe_api_error';
        if (code === 'already_subscribed') {
          await refreshPlanFromStripe();
          onToast?.(stripeErrorMessage(code, locale));
          onSelect();
          return;
        }
        onToast?.(stripeErrorMessage(code, locale));
      } finally {
        setCheckoutLoading(false);
      }
      return;
    }

    setPlan(plan);
    onSelect();
  };

  const priceSuffix = (plan: Plan) => {
    if (plan === 'free') return null;
    return billingCycle === 'annual' ? t('perYear', locale) : t('perMonth', locale);
  };

  const handlePlanAction = async (plan: Plan) => {
    if (plan === current && isPaidPlan(current) && isStripeCheckoutEnabled()) {
      try {
        setCheckoutLoading(true);
        await openStripePortal();
      } catch (err) {
        onToast?.(stripeErrorMessage(err instanceof Error ? err.message : 'stripe_api_error', locale));
      } finally {
        setCheckoutLoading(false);
      }
      return;
    }
    await select(plan);
  };

  const planButtonLabel = (plan: Plan) => {
    if (plan === current) {
      if (isPaidPlan(current) && isStripeCheckoutEnabled()) {
        return t('settingsManagePlan', locale);
      }
      return t('current', locale);
    }
    return t('planSelectNamed', locale).replace('{plan}', planTitle(plan, locale));
  };

  const planButtonDisabled = (plan: Plan) => {
    if (plan === current && current === 'free') return true;
    if (plan === 'free' && current !== 'free') return true;
    if (checkoutLoading) return true;
    return isStripeCheckoutEnabled() && plan !== 'free' && !canCheckoutPlan(current, plan);
  };

  return (
    <div className="screen flow-screen pricing-screen">
      <header className="top-bar top-bar-safe">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back', locale)}>
          <BackIcon />
        </button>
        <h2 className="screen-title">{t('pricingTitle', locale)}</h2>
        <span className="top-spacer" />
      </header>

      <main className="pricing-main scroll-natural">
        <p className="pricing-intro">{t('pricingIntro', locale)}</p>
        <BillingCycleToggle locale={locale} value={billingCycle} onChange={handleBillingCycle} />

        {current === 'free' ? (
          <p className="pricing-free-status" role="status">
            {t('planCurrentFreeHint', locale)}
          </p>
        ) : (
          <p className="pricing-active-plan" role="status">
            {t('yourPlan', locale)} : <strong>{planTitle(current, locale)}</strong>
          </p>
        )}

        <div className="pricing-cards">
          {paidPlans.map((plan) => {
            const featured = plan === 'plus' && current === 'free';
            const isCurrent = plan === current;
            const heart = heartLabel(PLAN_HEART_TIER[plan], locale);
            return (
              <article
                key={plan}
                className={`pricing-card pricing-card--${plan}${featured ? ' pricing-card--featured' : ''}${isCurrent ? ' current' : ''}`}
              >
                <div className="pricing-header">
                  <div className="pricing-header-copy">
                    <div className="pricing-title-row">
                      <h3>{planTitle(plan, locale)}</h3>
                      {featured && <span className="pricing-popular">{t('planPopular', locale)}</span>}
                      {plan === 'max' && !isCurrent && (
                        <span className="pricing-max-pill">{t('planMaxBadge', locale)}</span>
                      )}
                      {isCurrent && <span className="pricing-current-pill">{t('current', locale)}</span>}
                    </div>
                    <p className="pricing-tagline">{t(TAGLINE_KEY[plan as Exclude<Plan, 'free'>], locale)}</p>
                  </div>
                  <div className="pricing-price-block">
                    <span className="pricing-price">
                      {planPrice(plan, billingCycle)}
                      <small>{priceSuffix(plan)}</small>
                    </span>
                    {billingCycle === 'annual' && (
                      <span className="pricing-equivalent">
                        {t('billingEquivalentMonthly', locale).replace(
                          '{price}',
                          planMonthlyEquivalent(plan) ?? '',
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pricing-metrics">
                  <div className="pricing-metric">
                    <strong>{heart}</strong>
                    <span>{t('planCardHeartsLabel', locale)}</span>
                  </div>
                  <div className="pricing-metric">
                    <strong>{PLAN_LIMITS[plan].pathSteps}</strong>
                    <span>{t('planCardPathLabel', locale)}</span>
                  </div>
                  <div className="pricing-metric">
                    <strong>✓</strong>
                    <span>{t('planCardStatusLabel', locale)}</span>
                  </div>
                </div>

                <ul className="pricing-highlights">
                  {EXCLUSIVE_PERKS[plan].map((key) => (
                    <li key={key}>{t(key, locale)}</li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={isCurrent ? 'btn-secondary pricing-select-btn' : 'btn-primary pricing-select-btn'}
                  disabled={planButtonDisabled(plan)}
                  onClick={() => void handlePlanAction(plan)}
                >
                  {planButtonLabel(plan)}
                </button>
              </article>
            );
          })}
        </div>

        <section className="pricing-compare-section">
          <h3 className="pricing-compare-title">{t('pricingCompareTitle', locale)}</h3>
          <div className="pricing-compare-wrap">
            <table className="pricing-compare">
              <thead>
                <tr>
                  <th>{t('compareFeature', locale)}</th>
                  {PLANS.map((plan) => (
                    <th key={plan} className={plan === current ? 'col-current' : ''}>
                      {planTitle(plan, locale)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.labelKey}>
                    <td>{t(row.labelKey, locale)}</td>
                    <td className={current === 'free' ? 'col-current' : ''}>{row.free}</td>
                    <td className={current === 'plus' ? 'col-current' : ''}>{row.plus}</td>
                    <td className={current === 'pro' ? 'col-current' : ''}>{row.pro}</td>
                    <td className={current === 'max' ? 'col-current' : ''}>{row.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="pricing-note">
          {isStripeCheckoutEnabled() ? t('pricingStripe', locale) : t('pricingSimulated', locale)}
        </p>
        {isStripeCheckoutEnabled() && isPaidPlan(current) && current !== 'max' && (
          <p className="pricing-upgrade-policy">{t('subscriptionUpgradeBlockedHint', locale)}</p>
        )}
      </main>
    </div>
  );
}
