import { t } from '../lib/i18n';
import type { Locale, TrainingFocus } from '../types';

const OPTIONS: {
  id: TrainingFocus;
  icon: string;
  titleKey: 'trainingFocusWritten' | 'trainingFocusOral';
  descKey: 'trainingFocusWrittenDesc' | 'trainingFocusOralDesc';
}[] = [
  { id: 'written', icon: '✍️', titleKey: 'trainingFocusWritten', descKey: 'trainingFocusWrittenDesc' },
  { id: 'oral', icon: '🎧', titleKey: 'trainingFocusOral', descKey: 'trainingFocusOralDesc' },
];

interface TrainingFocusPickerProps {
  locale: Locale;
  value: TrainingFocus[];
  onChange: (focus: TrainingFocus[]) => void;
}

export function TrainingFocusPicker({ locale, value, onChange }: TrainingFocusPickerProps) {
  const toggle = (id: TrainingFocus) => {
    const active = value.includes(id);
    if (active && value.length === 1) return;
    onChange(active ? value.filter((f) => f !== id) : [...value, id]);
  };

  return (
    <section className="training-focus-picker">
      <h3 className="training-focus-title">{t('trainingFocusTitle', locale)}</h3>
      <p className="training-focus-intro">{t('trainingFocusIntro', locale)}</p>
      <div className="training-focus-options">
        {OPTIONS.map((opt) => {
          const selected = value.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              className={`training-focus-card${selected ? ' training-focus-card--active' : ''}`}
              onClick={() => toggle(opt.id)}
              aria-pressed={selected}
            >
              <span className="training-focus-icon" aria-hidden="true">
                {opt.icon}
              </span>
              <span className="training-focus-label">{t(opt.titleKey, locale)}</span>
              <span className="training-focus-desc">{t(opt.descKey, locale)}</span>
              <span className="training-focus-check" aria-hidden="true">
                {selected ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
