import { planAnnualSavingsPercent } from '../lib/planLimits';
import { t } from '../lib/i18n';
import type { BillingCycle, Locale } from '../types';

interface BillingCycleToggleProps {
  locale: Locale;
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  showSavings?: boolean;
}

export function BillingCycleToggle({
  locale,
  value,
  onChange,
  showSavings = true,
}: BillingCycleToggleProps) {
  const savings = planAnnualSavingsPercent('plus');

  return (
    <div className="billing-cycle-toggle" role="group" aria-label={t('billingCycleLabel', locale)}>
      <button
        type="button"
        className={`billing-cycle-btn ${value === 'monthly' ? 'active' : ''}`}
        aria-pressed={value === 'monthly'}
        onClick={() => onChange('monthly')}
      >
        {t('billingMonthly', locale)}
      </button>
      <button
        type="button"
        className={`billing-cycle-btn ${value === 'annual' ? 'active' : ''}`}
        aria-pressed={value === 'annual'}
        onClick={() => onChange('annual')}
      >
        {t('billingAnnual', locale)}
        {showSavings && savings > 0 && (
          <span className="billing-save-badge">-{savings}%</span>
        )}
      </button>
    </div>
  );
}
