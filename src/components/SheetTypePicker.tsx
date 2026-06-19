import { t } from '../lib/i18n';
import type { Locale, SheetType } from '../types';

const OPTIONS: {
  id: SheetType;
  icon: string;
  titleKey: 'sheetTypeVocab' | 'sheetTypeNotes' | 'sheetTypeDefinitions' | 'sheetTypeMath';
  descKey: 'sheetTypeVocabDesc' | 'sheetTypeNotesDesc' | 'sheetTypeDefinitionsDesc' | 'sheetTypeMathDesc';
}[] = [
  { id: 'vocab', icon: '📚', titleKey: 'sheetTypeVocab', descKey: 'sheetTypeVocabDesc' },
  { id: 'notes', icon: '📝', titleKey: 'sheetTypeNotes', descKey: 'sheetTypeNotesDesc' },
  { id: 'definitions', icon: '🔢', titleKey: 'sheetTypeDefinitions', descKey: 'sheetTypeDefinitionsDesc' },
  { id: 'math', icon: '📐', titleKey: 'sheetTypeMath', descKey: 'sheetTypeMathDesc' },
];

interface SheetTypePickerProps {
  locale: Locale;
  value: SheetType;
  onChange: (type: SheetType) => void;
  /** Premium centered grid for the post-import configure step. */
  variant?: 'default' | 'premium';
}

export function SheetTypePicker({ locale, value, onChange, variant = 'default' }: SheetTypePickerProps) {
  const premium = variant === 'premium';

  return (
    <section className={`sheet-type-picker${premium ? ' sheet-type-picker--premium' : ''}`}>
      {!premium && (
        <>
          <h3 className="sheet-type-picker-title">{t('sheetTypeTitle', locale)}</h3>
          <p className="sheet-type-picker-intro">{t('sheetTypeIntro', locale)}</p>
        </>
      )}
      <div className={`sheet-type-options${premium ? ' sheet-type-options--grid' : ''}`}>
        {OPTIONS.map((opt, index) => (
          <button
            key={opt.id}
            type="button"
            className={`sheet-type-card${premium ? ' sheet-type-card--premium' : ''} ${value === opt.id ? 'sheet-type-card--active' : ''}`}
            style={premium ? { animationDelay: `${index * 60}ms` } : undefined}
            onClick={() => onChange(opt.id)}
            aria-pressed={value === opt.id}
          >
            <span className="sheet-type-icon" aria-hidden="true">
              {opt.icon}
            </span>
            <span className="sheet-type-label">{t(opt.titleKey, locale)}</span>
            <span className="sheet-type-desc">{t(opt.descKey, locale)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
