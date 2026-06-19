import { hasFeature, PLAN_LIMITS } from '../lib/planLimits';
import { usePlan } from '../hooks/usePlan';
import { t } from '../lib/i18n';
import type { Locale, UpgradeReason } from '../types';

interface PlanPerksBarProps {
  locale: Locale;
  onLockedClick?: (reason: UpgradeReason) => void;
}

const FEATURE_REASON: Record<string, UpgradeReason> = {
  spaced: 'feature',
  synthesis: 'synthesis',
  stats: 'stats',
  exam: 'exam',
  share: 'share',
};

export function PlanPerksBar({ locale, onLockedClick }: PlanPerksBarProps) {
  const plan = usePlan();

  let summary = '';
  if (plan === 'free') {
    summary = t('activePerksFree', locale)
      .replace('{scans}', String(PLAN_LIMITS.free.scansPerDay))
      .replace('{words}', String(PLAN_LIMITS.free.maxWords));
  } else if (plan === 'plus') {
    summary = t('activePerksPlus', locale);
  } else {
    summary = t('activePerksPro', locale);
  }

  const chips = [
    { feature: 'spaced' as const, label: t('planPerkSpacedShort', locale) },
    { feature: 'synthesis' as const, label: t('synthesis', locale) },
    { feature: 'stats' as const, label: t('statsTitle', locale) },
    { feature: 'exam' as const, label: t('examMode', locale) },
    { feature: 'share' as const, label: t('shareDeck', locale) },
  ];

  return (
    <div className="plan-perks-bar">
      <p className="plan-perks-summary">{summary}</p>
      <div className="plan-perks-chips">
        {chips.map((c) => {
          const unlocked = hasFeature(c.feature);
          return (
            <button
              key={c.feature}
              type="button"
              className={`plan-perk-chip ${unlocked ? 'unlocked' : 'locked'}`}
              disabled={unlocked}
              onClick={() => {
                if (!unlocked && onLockedClick) onLockedClick(FEATURE_REASON[c.feature]);
              }}
            >
              {!unlocked && '🔒 '}
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
