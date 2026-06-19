import { useState } from 'react';
import { usePlan } from '../hooks/usePlan';
import {
  getHistoryMax,
  getScansRemaining,
  hasFeature,
  PLAN_LIMITS,
} from '../lib/planLimits';
import { isStripeCheckoutEnabled, openStripePortal, stripeErrorMessage } from '../lib/stripeCheckout';
import { PlanBadge } from './PlanBadge';
import { t } from '../lib/i18n';
import type { Locale, Plan } from '../types';

interface PlanCardProps {
  locale: Locale;
  refreshKey?: number;
  onUpgrade?: () => void;
  onToast?: (message: string) => void;
}

function planActiveHint(plan: Plan, locale: Locale): string {
  if (plan === 'pro') return t('planProActiveHint', locale);
  if (plan === 'plus') return t('planPlusActiveHint', locale);
  return '';
}

export function PlanCard({ locale, refreshKey = 0, onUpgrade, onToast }: PlanCardProps) {
  const plan = usePlan(refreshKey);
  const [portalLoading, setPortalLoading] = useState(false);
  const limits = PLAN_LIMITS[plan];
  const scansLeft = getScansRemaining();
  const historyMax = getHistoryMax();

  const perks = [
    {
      ok: true,
      text:
        plan !== 'free'
          ? `∞ ${t('planPerkScansUnlimited', locale)}`
          : `${scansLeft} / ${limits.scansPerDay} ${t('scansToday', locale)}`,
    },
    { ok: true, text: `${limits.maxWords} ${t('planPerkWords', locale)}` },
    { ok: hasFeature('spaced', plan), text: t('planPerkSpaced', locale) },
    { ok: hasFeature('export', plan), text: t('planPerkExport', locale) },
    { ok: hasFeature('stats', plan), text: t('planPerkStats', locale) },
    { ok: hasFeature('exam', plan), text: t('planPerkExam', locale) },
    { ok: hasFeature('share', plan), text: t('planPerkShare', locale) },
  ];

  const handleManage = async () => {
    if (!isStripeCheckoutEnabled()) {
      onUpgrade?.();
      return;
    }
    try {
      setPortalLoading(true);
      await openStripePortal();
    } catch (err) {
      onToast?.(stripeErrorMessage(err instanceof Error ? err.message : 'stripe_api_error', locale));
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className={`plan-card plan-card--${plan}`}>
      <div className="plan-card-head">
        <span className="plan-card-title">{t('yourPlan', locale)}</span>
        <PlanBadge plan={plan} locale={locale} />
      </div>
      <ul className="plan-card-perks">
        {perks.map((p) => (
          <li key={p.text} className={p.ok ? 'ok' : 'locked'}>
            <span aria-hidden="true">{p.ok ? '✓' : '🔒'}</span>
            {p.text}
          </li>
        ))}
      </ul>
      {plan === 'free' && historyMax < 9999 && (
        <p className="plan-card-hint">
          {t('historyLimitHint', locale).replace('{max}', String(historyMax))}
        </p>
      )}
      {plan !== 'free' && (
        <p className="plan-card-hint plan-card-hint--active">{planActiveHint(plan, locale)}</p>
      )}
      {plan === 'free' && onUpgrade && (
        <button type="button" className="btn-primary plan-card-upgrade" onClick={onUpgrade}>
          {t('upgradePlus', locale)}
        </button>
      )}
      {plan !== 'free' && (
        <div className="plan-card-actions">
          <button
            type="button"
            className="btn-primary plan-card-upgrade"
            onClick={() => void handleManage()}
            disabled={portalLoading}
          >
            {portalLoading ? t('portalOpening', locale) : t('settingsManagePlan', locale)}
          </button>
          {onUpgrade && (
            <button type="button" className="btn-secondary plan-card-secondary" onClick={onUpgrade}>
              {t('settingsChangePlan', locale)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
