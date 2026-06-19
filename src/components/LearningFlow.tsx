import { t } from '../lib/i18n';
import type { Locale } from '../types';

export type FlowStep = 'sheet' | 'game' | 'score' | 'progress';

interface LearningFlowProps {
  active: FlowStep;
  locale: Locale;
  compact?: boolean;
}

const STEPS: { id: FlowStep; icon: string; labelKey: 'flowSheet' | 'flowGame' | 'flowScore' | 'flowProgress' }[] = [
  { id: 'sheet', icon: '📄', labelKey: 'flowSheet' },
  { id: 'game', icon: '🎮', labelKey: 'flowGame' },
  { id: 'score', icon: '🏆', labelKey: 'flowScore' },
  { id: 'progress', icon: '📈', labelKey: 'flowProgress' },
];

export function LearningFlow({ active, locale, compact = false }: LearningFlowProps) {
  const activeIdx = STEPS.findIndex((s) => s.id === active);

  return (
    <div className={`learning-flow ${compact ? 'learning-flow--compact' : ''}`} aria-label={t('flowTitle', locale)}>
      {STEPS.map((step, i) => {
        const isActive = step.id === active;
        const isDone = i < activeIdx;
        return (
          <div key={step.id} className="learning-flow-item-wrap">
            {i > 0 && (
              <span
                className={`learning-flow-arrow ${isDone || isActive ? 'lit' : ''}`}
                aria-hidden="true"
              >
                →
              </span>
            )}
            <div
              className={`learning-flow-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
            >
              <span className="learning-flow-icon" aria-hidden="true">
                {step.icon}
              </span>
              {!compact && <span className="learning-flow-label">{t(step.labelKey, locale)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
