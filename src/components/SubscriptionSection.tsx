import { useState } from 'react';
import { PlanBadge } from './PlanBadge';
import { PlanPerksBar } from './PlanPerksBar';
import { PlanUsageBars } from './PlanUsageBars';
import { usePlan } from '../hooks/usePlan';
import { t } from '../lib/i18n';
import {
  getBillingCycle,
  isPaidPlan,
  planLabel,
  planMonthlyEquivalent,
  planPrice,
} from '../lib/planLimits';
import { isStripeCheckoutEnabled, openStripePortal, stripeErrorMessage } from '../lib/stripeCheckout';
import {
  formatSubscriptionDate,
  getSubscriptionCancelAtPeriodEnd,
  getSubscriptionPeriodEnd,
} from '../lib/subscription';
import type { Locale, Plan } from '../types';

interface SubscriptionSectionProps {
  locale: Locale;
  isLoggedIn: boolean;
  refreshKey?: number;
  onPricing: () => void;
  onAuth: () => void;
  onToast?: (message: string) => void;
  embedded?: boolean;
}

function primaryCtaKey(plan: Plan): 'upgradePlus' | 'settingsManagePlan' {
  return plan === 'free' ? 'upgradePlus' : 'settingsManagePlan';
}

export function SubscriptionSection({
  locale,
  isLoggedIn,
  refreshKey = 0,
  onPricing,
  onAuth,
  onToast,
  embedded = false,
}: SubscriptionSectionProps) {
  const plan = usePlan(refreshKey);
  const effectivePlan = isLoggedIn ? plan : 'free';
  const billingCycle = getBillingCycle();
  const [portalLoading, setPortalLoading] = useState(false);
  const [periodEnd] = useState<Date | null>(() => getSubscriptionPeriodEnd());
  const [cancelAtEnd] = useState(() => getSubscriptionCancelAtPeriodEnd());

  const pricePeriod =
    effectivePlan === 'free'
      ? null
      : billingCycle === 'annual'
        ? t('perYear', locale)
        : t('perMonth', locale);

  const handleManage = async () => {
    if (effectivePlan !== 'free' && isStripeCheckoutEnabled()) {
      try {
        setPortalLoading(true);
        await openStripePortal();
      } catch (err) {
        onToast?.(stripeErrorMessage(err instanceof Error ? err.message : 'stripe_api_error', locale));
      } finally {
        setPortalLoading(false);
      }
      return;
    }
    onPricing();
  };

  const content = (
    <>
      {!embedded && <h3 className="settings-label">{t('currentPlan', locale)}</h3>}
      {embedded && <p className="profile-subscription-label">{t('currentPlan', locale)}</p>}

      <div
        className={`subscription-card ${embedded ? 'subscription-card--embedded' : ''} subscription-card--${effectivePlan}`}
      >
        <div className="subscription-card-head">
          <div className="subscription-card-plan">
            <PlanBadge plan={effectivePlan} locale={locale} />
            <div>
              <p className="subscription-plan-name">{planLabel(effectivePlan)}</p>
              <p className="subscription-plan-price">
                {isPaidPlan(effectivePlan)
                  ? `${planPrice(effectivePlan, billingCycle)}${pricePeriod ? ` · ${pricePeriod}` : ''}`
                  : t('planFree', locale)}
              </p>
              {billingCycle === 'annual' && isPaidPlan(effectivePlan) && (
                <p className="subscription-plan-equivalent">
                  {t('billingEquivalentMonthly', locale).replace(
                    '{price}',
                    planMonthlyEquivalent(effectivePlan) ?? '',
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        {isLoggedIn && <PlanUsageBars locale={locale} refreshKey={refreshKey} />}

        {isLoggedIn && effectivePlan !== 'free' && periodEnd && isStripeCheckoutEnabled() && (
          <div className="subscription-period-info">
            <p className="subscription-period-line">
              {cancelAtEnd
                ? t('subscriptionEndsOn', locale).replace(
                    '{date}',
                    formatSubscriptionDate(periodEnd, locale),
                  )
                : t('subscriptionRenewsOn', locale).replace(
                    '{date}',
                    formatSubscriptionDate(periodEnd, locale),
                  )}
            </p>
            {cancelAtEnd ? (
              <p className="subscription-period-note">{t('subscriptionRenewalCanceled', locale)}</p>
            ) : (
              <p className="subscription-period-note">{t('subscriptionManageHint', locale)}</p>
            )}
          </div>
        )}

        {isLoggedIn ? (
          <>
            <PlanPerksBar locale={locale} onLockedClick={() => onPricing()} />
            <button
              type="button"
              className="btn-primary btn-lg subscription-cta"
              onClick={() => void handleManage()}
              disabled={portalLoading}
            >
              {portalLoading
                ? t('portalOpening', locale)
                : t(primaryCtaKey(effectivePlan), locale)}
            </button>
            {effectivePlan !== 'free' && (
              <button type="button" className="btn-secondary subscription-cta-secondary" onClick={onPricing}>
                {t('settingsChangePlan', locale)}
              </button>
            )}
            {effectivePlan === 'free' && (
              <button type="button" className="btn-secondary subscription-cta-secondary" onClick={onPricing}>
                {t('settingsViewPlans', locale)}
              </button>
            )}
          </>
        ) : (
          <>
            <p className="subscription-guest-hint">{t('settingsPlanGuestHint', locale)}</p>
            <button type="button" className="btn-primary btn-lg subscription-cta" onClick={onAuth}>
              {t('connect', locale)}
            </button>
            <button type="button" className="btn-secondary subscription-cta-secondary" onClick={onPricing}>
              {t('settingsViewPlans', locale)}
            </button>
          </>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className="profile-subscription-block">{content}</div>;
  }

  return <section className="settings-section subscription-section">{content}</section>;
}
