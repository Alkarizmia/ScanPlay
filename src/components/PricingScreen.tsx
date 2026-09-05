import { useEffect, useMemo, useState } from 'react';
import { BillingCycleToggle } from './BillingCycleToggle';
import { BackIcon } from './icons/BackIcon';
import { usePlan } from '../hooks/usePlan';
import { isLoggedIn } from '../lib/auth';
import { t, type TranslationKey } from '../lib/i18n';
import {
  formatGapFactor,
  getBillingCycle,
  PLAN_LIMITS,
  planGapVsFree,
  planMonthlyEquivalent,
  planPrice,
  setBillingCycle,
  setPlan,
} from '../lib/planLimits';
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

const PLANS: Plan[] = ['free', 'plus', 'pro'];

const EXCLUSIVE_PERKS: Record<Plan, TranslationKey[]> = {
            free: ['compareHistory', 'compareReplay'],
  plus: ['planPerkSpaced', 'planPerkSynthesis', 'planPerkStats'],
  pro: ['planPerkSpaced', 'planPerkSynthesis', 'planPerkStats', 'planPerkExam', 'planPerkShare'],
};

type CompareRow = {
  labelKey: TranslationKey;
  free: string;
  plus: string;
  pro: string;
};

const ROWS: CompareRow[] = [
  { labelKey: 'compareScanAi', free: 'gpt-4.1', plus: 'gpt-5.5', pro: 'gpt-5.5' },
  { labelKey: 'compareScans', free: `${PLAN_LIMITS.free.scansPerDay}/j`, plus: `${PLAN_LIMITS.plus.scansPerDay}/j`, pro: `${PLAN_LIMITS.pro.scansPerDay}/j` },
  { labelKey: 'compareWords', free: String(PLAN_LIMITS.free.maxWords), plus: String(PLAN_LIMITS.plus.maxWords), pro: String(PLAN_LIMITS.pro.maxWords) },
  { labelKey: 'comparePath', free: String(PLAN_LIMITS.free.pathSteps), plus: String(PLAN_LIMITS.plus.pathSteps), pro: String(PLAN_LIMITS.pro.pathSteps) },
  { labelKey: 'compareHistory', free: `${PLAN_LIMITS.free.historyMax}`, plus: '∞', pro: '∞' },
  { labelKey: 'compareReplay', free: `${PLAN_LIMITS.free.historyReplay}`, plus: `${PLAN_LIMITS.plus.historyReplay}`, pro: `${PLAN_LIMITS.pro.historyReplay}` },
  { labelKey: 'compareSpaced', free: '·', plus: '✓', pro: '✓' },
  { labelKey: 'compareSynthesis', free: '2/m', plus: '15/m', pro: '40/m' },
  { labelKey: 'compareStats', free: '·', plus: '✓', pro: '✓' },
  { labelKey: 'compareExam', free: '·', plus: '·', pro: '✓' },
  { labelKey: 'compareShare', free: '·', plus: '·', pro: '✓' },
];

function planTitle(plan: Plan, locale: Locale) {
  if (plan === 'free') return t('planFree', locale);
  if (plan === 'plus') return t('planPlus', locale);
  return t('planPro', locale);
}

export function PricingScreen({ locale, refreshKey = 0, onBack, onSelect, onAuth, onToast }: PricingScreenProps) {
  const current = usePlan(refreshKey);
  const [billingCycle, setBillingCycleState] = useState<BillingCycle>(() => getBillingCycle());
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn() || !isStripeCheckoutEnabled()) return;
    void refreshPlanFromStripe();
  }, [refreshKey]);

  const paidPlans = useMemo<Plan[]>(() => {
    if (current === 'pro') return ['pro', 'plus'];
    return ['plus', 'pro'];
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
    if (plan === current && current !== 'free' && isStripeCheckoutEnabled()) {
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
      if (current !== 'free' && isStripeCheckoutEnabled()) {
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
            {t('planCurrentFreeHint', locale).replace('{scans}', String(PLAN_LIMITS.free.scansPerDay))}
          </p>
        ) : (
          <p className="pricing-active-plan" role="status">
            {t('yourPlan', locale)} : <strong>{planTitle(current, locale)}</strong>
          </p>
        )}

        <div className="pricing-cards">
          {paidPlans.map((plan) => {
            const limits = PLAN_LIMITS[plan];
            const gap = planGapVsFree(plan);
            const featured = plan === 'plus' && current === 'free';
            const isCurrent = plan === current;
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
                      {isCurrent && <span className="pricing-current-pill">{t('current', locale)}</span>}
                    </div>
                    <p className="pricing-tagline">
                      {t(plan === 'plus' ? 'planPlusTagline' : 'planProTagline', locale)}
                    </p>
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
                    <strong>{limits.scansPerDay}</strong>
                    <span>{t('planCardScansLabel', locale)}</span>
                  </div>
                  <div className="pricing-metric">
                    <strong>{limits.maxWords}</strong>
                    <span>{t('planCardWordsLabel', locale)}</span>
                  </div>
                  <div className="pricing-metric">
                    <strong>GPT-5.5</strong>
                    <span>{t('planCardAiLabel', locale)}</span>
                  </div>
                </div>

                {gap && (
                  <div className="pricing-gap-chips">
                    <span>
                      ×{formatGapFactor(gap.scanFactor, locale)} {t('planCardScansLabel', locale)}
                    </span>
                    <span>
                      ×{formatGapFactor(gap.wordFactor, locale)} {t('planCardWordsLabel', locale)}
                    </span>
                    <span>vs Free</span>
                  </div>
                )}

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
                {ROWS.map((row) => (
                  <tr key={row.labelKey}>
                    <td>{t(row.labelKey, locale)}</td>
                    <td className={current === 'free' ? 'col-current' : ''}>{row.free}</td>
                    <td className={current === 'plus' ? 'col-current' : ''}>{row.plus}</td>
                    <td className={current === 'pro' ? 'col-current' : ''}>{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="pricing-note">
          {isStripeCheckoutEnabled() ? t('pricingStripe', locale) : t('pricingSimulated', locale)}
        </p>
        {isStripeCheckoutEnabled() && current !== 'free' && current !== 'pro' && (
          <p className="pricing-upgrade-policy">{t('subscriptionUpgradeBlockedHint', locale)}</p>
        )}
      </main>
    </div>
  );
}
