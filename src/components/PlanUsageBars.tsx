import { usePlan } from '../hooks/usePlan';
import { t } from '../lib/i18n';
import { getPlanUsageSnapshot } from '../lib/planUsage';
import type { Locale } from '../types';

interface PlanUsageBarsProps {
  locale: Locale;
  refreshKey?: number;
}

export function PlanUsageBars({ locale, refreshKey = 0 }: PlanUsageBarsProps) {
  usePlan(refreshKey);
  const snap = getPlanUsageSnapshot();
  const periodKey = snap.period === 'week' ? 'usagePeriodWeek' : 'usagePeriodMonth';
  const tokenLine = snap.lines.find((l) => l.id === 'tokens');
  if (!tokenLine) return null;

  const tokenPct = tokenLine.percentUsed;

  return (
    <div className="plan-usage" role="group" aria-label={t('usageTitle', locale)}>
      <div className="plan-usage-line">
        <div className="plan-usage-head">
          <p className="plan-usage-title">
            <strong>{t('usageTokensTitle', locale)}</strong>
            <span className="plan-usage-sub"> · {t('usageTokensSub', locale)}</span>
          </p>
          <span className="plan-usage-pct">
            {t('usagePercentUsed', locale).replace('{pct}', String(tokenPct))}
          </span>
        </div>
        <div
          className="plan-usage-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={tokenPct}
          aria-label={t('usageTokensTitle', locale)}
        >
          <div className="plan-usage-fill plan-usage-fill--tokens" style={{ width: `${tokenPct}%` }} />
        </div>
        <p className="plan-usage-foot">
          {t('usageTokensFoot', locale)} · {t(periodKey, locale)}
        </p>
      </div>
    </div>
  );
}
