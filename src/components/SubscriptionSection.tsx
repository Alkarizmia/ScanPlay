import { useState } from 'react';

import { BillingCycleToggle } from './BillingCycleToggle';
import { usePlan } from '../hooks/usePlan';
import { PlanBadge } from './PlanBadge';
import { PlanPerksBar } from './PlanPerksBar';

import {

  getBillingCycle,

  getScansRemaining,

  planLabel,

  planMonthlyEquivalent,

  planPrice,

  setBillingCycle,

} from '../lib/planLimits';

import {

  isStripeCheckoutEnabled,

  openStripePortal,

  stripeErrorMessage,

} from '../lib/stripeCheckout';

import {

  formatSubscriptionDate,

  getSubscriptionCancelAtPeriodEnd,

  getSubscriptionPeriodEnd,

} from '../lib/subscription';

import { t } from '../lib/i18n';

import type { BillingCycle, Locale, Plan } from '../types';



interface SubscriptionSectionProps {

  locale: Locale;

  isLoggedIn: boolean;

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

  onPricing,

  onAuth,

  onToast,

  embedded = false,

}: SubscriptionSectionProps) {

  const plan = usePlan();
  const effectivePlan = isLoggedIn ? plan : 'free';
  const [billingCycle, setBillingCycleState] = useState<BillingCycle>(() => getBillingCycle());
  const [portalLoading, setPortalLoading] = useState(false);
  const [periodEnd] = useState<Date | null>(() => getSubscriptionPeriodEnd());
  const [cancelAtEnd] = useState(() => getSubscriptionCancelAtPeriodEnd());

  const scansLeft = isLoggedIn ? getScansRemaining() : null;


  const handleBillingCycle = (cycle: BillingCycle) => {

    setBillingCycleState(cycle);

    setBillingCycle(cycle);

  };



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



      <BillingCycleToggle locale={locale} value={billingCycle} onChange={handleBillingCycle} />



      <div className={`subscription-card ${embedded ? 'subscription-card--embedded' : ''} subscription-card--${effectivePlan}`}>
        <div className="subscription-card-head">
          <div className="subscription-card-plan">
            <PlanBadge plan={effectivePlan} locale={locale} />
            <div>
              <p className="subscription-plan-name">{planLabel(effectivePlan)}</p>
              <p className="subscription-plan-price">
                {planPrice(effectivePlan, billingCycle)}
                {pricePeriod && ` · ${pricePeriod}`}
              </p>
              {billingCycle === 'annual' && effectivePlan !== 'free' && (

                <p className="subscription-plan-equivalent">

                  {t('billingEquivalentMonthly', locale).replace(

                    '{price}',

                    planMonthlyEquivalent(effectivePlan) ?? '',

                  )}

                </p>

              )}

            </div>

          </div>

          {isLoggedIn && effectivePlan !== 'free' && (
            <span className="subscription-scans-pill subscription-scans-pill--unlimited">
              ∞ {t('planPerkScansUnlimited', locale)}
            </span>
          )}
          {isLoggedIn && effectivePlan === 'free' && scansLeft !== null && (
            <span className="subscription-scans-pill">
              {scansLeft} / 3 {t('scansToday', locale)}
            </span>
          )}

        </div>



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


