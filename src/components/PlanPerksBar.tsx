import { LockIcon } from './icons/LockIcon';
import { hasFeature, PLAN_LIMITS } from '../lib/planLimits';
import { usePlan } from '../hooks/usePlan';
import { t } from '../lib/i18n';
import { PLAN_HEART_TIER } from '../lib/planUsage';
import type { Locale, UpgradeReason } from '../types';

interface PlanPerksBarProps {
  locale: Locale;
  onLockedClick?: (reason: UpgradeReason) => void;
}

const FEATURE_REASON: Record<string, UpgradeReason> = {
  spaced: 'feature',
  stats: 'stats',
  exam: 'exam',
  share: 'share',
};

function heartSummary(plan: ReturnType<typeof usePlan>, locale: Locale): string {
  const tier = PLAN_HEART_TIER[plan];
  if (tier === '3') return '3';
  if (tier === '5regen') return `5 · ${t('heartsRegenFast', locale)}`;
  return '∞';
}

export function PlanPerksBar({ locale, onLockedClick }: PlanPerksBarProps) {
  const plan = usePlan();
  const summaryKey =
    plan === 'free'
      ? 'activePerksFree'
      : plan === 'plus'
        ? 'activePerksPlus'
        : plan === 'max'
          ? 'activePerksMax'
          : 'activePerksPro';

  const summary = t(summaryKey, locale)
    .replace('{hearts}', heartSummary(plan, locale))
    .replace('{steps}', String(PLAN_LIMITS[plan].pathSteps));

  const chips = [
    { feature: 'spaced' as const, label: t('planPerkSpacedShort', locale) },
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
              {!unlocked && <LockIcon size={11} />}
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
