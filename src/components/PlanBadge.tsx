import { planLabel } from '../lib/planLimits';
import { t } from '../lib/i18n';
import type { Locale, Plan } from '../types';

interface PlanBadgeProps {
  plan: Plan;
  locale: Locale;
}

export function PlanBadge({ plan, locale }: PlanBadgeProps) {
  const icons: Record<Plan, string> = { free: '', plus: '✦', pro: '★' };
  const label = plan === 'free' ? t('planFree', locale) : planLabel(plan);

  return (
    <span className={`plan-badge plan-badge--${plan}`}>
      {label}
      {icons[plan] && <span className="plan-badge-icon">{icons[plan]}</span>}
    </span>
  );
}
