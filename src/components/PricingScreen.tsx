import { useEffect, useMemo, useState } from 'react';
import { BillingCycleToggle } from './BillingCycleToggle';
import { usePlan } from '../hooks/usePlan';
import { isLoggedIn } from '../lib/auth';
import { t, type TranslationKey } from '../lib/i18n';
import {
  getBillingCycle,
  PLAN_LIMITS,
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

const PLAN_HIGHLIGHTS: Record<Plan, TranslationKey[]> = {
  free: ['compareScans', 'compareWords', 'compareHistory'],
  plus: ['compareScans', 'compareWords', 'compareHistory', 'planPerkSpaced', 'planPerkSynthesis', 'planPerkStats'],
  pro: ['compareScans', 'compareWords', 'compareHistory', 'planPerkSpaced', 'planPerkSynthesis', 'planPerkStats', 'planPerkExam', 'planPerkShare'],
};

type CompareRow = {
  labelKey: TranslationKey;
  free: string;
  plus: string;
  pro: string;
};

const ROWS: CompareRow[] = [
  { labelKey: 'compareScans', free: '3/j', plus: '∞', pro: '∞' },
  { labelKey: 'compareWords', free: String(PLAN_LIMITS.free.maxWords), plus: String(PLAN_LIMITS.plus.maxWords), pro: String(PLAN_LIMITS.pro.maxWords) },
  { labelKey: 'compareHistory', free: '7', plus: '∞', pro: '∞' },
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

  const orderedPlans = useMemo(() => {
    if (current === 'free') return PLANS;
    return [current, ...PLANS.filter((p) => p !== current)];
  }, [current]);

  const upgradeTarget = useMemo<Plan | null>(() => {
    if (current === 'free') return 'plus';
    if (current === 'plus') return 'pro';
    return null;
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
    return t('select', locale);
  };

  const planButtonDisabled = (plan: Plan) => {
    if (plan === current && current === 'free') return true;
    if (plan === 'free' && current !== 'free') return true;
    if (checkoutLoading) return true;
    return (
      isStripeCheckoutEnabled() && plan !== 'free' && !canCheckoutPlan(current, plan)
    );
  };

  return (
    <div className="screen flow-screen pricing-screen">
      <header className="top-bar top-bar-safe">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back', locale)}>
          ←
        </button>
        <h2 className="screen-title">{t('pricingTitle', locale)}</h2>
        <span className="top-spacer" />
      </header>

      <main className="pricing-main scroll-natural">
        <BillingCycleToggle locale={locale} value={billingCycle} onChange={handleBillingCycle} />

        {current !== 'free' && (
          <p className="pricing-active-plan" role="status">
            {t('yourPlan', locale)} : <strong>{planTitle(current, locale)}</strong>
          </p>
        )}

        <div className="pricing-cards">
          {orderedPlans.map((plan) => (
            <div key={plan} className={`pricing-card ${plan === current ? 'current' : ''}`}>
              <div className="pricing-header">
                <div>
                  <h3>{planTitle(plan, locale)}</h3>
                  {plan === current && <span className="pricing-current-pill">{t('current', locale)}</span>}
                </div>
                <div className="pricing-price-block">
                  <span className="pricing-price">
                    {planPrice(plan, billingCycle)}
                    {plan !== 'free' && <small>{priceSuffix(plan)}</small>}
                  </span>
                  {billingCycle === 'annual' && plan !== 'free' && (
                    <span className="pricing-equivalent">
                      {t('billingEquivalentMonthly', locale).replace(
                        '{price}',
                        planMonthlyEquivalent(plan) ?? '',
                      )}
                    </span>
                  )}
                </div>
              </div>
              <ul className="pricing-highlights">
                {PLAN_HIGHLIGHTS[plan].map((key) => (
                  <li key={key}>{t(key, locale)}</li>
                ))}
              </ul>
              <button
                type="button"
                className={
                  plan === current && current === 'free'
                    ? 'btn-secondary pricing-select-btn'
                    : 'btn-primary pricing-select-btn'
                }
                disabled={planButtonDisabled(plan)}
                onClick={() => void handlePlanAction(plan)}
              >
                {planButtonLabel(plan)}
              </button>
            </div>
          ))}
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

      {upgradeTarget && (
        <div className="pricing-sticky-cta">
          <button
            type="button"
            className="btn-primary btn-lg"
            onClick={() => void select(upgradeTarget)}
            disabled={
              checkoutLoading ||
              (isStripeCheckoutEnabled() && !canCheckoutPlan(current, upgradeTarget))
            }
          >
            {t('select', locale)} {planTitle(upgradeTarget, locale)}
          </button>
        </div>
      )}
    </div>
  );
}
