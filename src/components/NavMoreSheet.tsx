import { t, type TranslationKey } from '../lib/i18n';
import { NavIcon } from './icons/NavIcon';
import type { Locale, TabId } from '../types';

const MORE_ITEMS: { id: TabId; labelKey: TranslationKey }[] = [
  { id: 'mistakes', labelKey: 'mistakes' },
  { id: 'achievements', labelKey: 'achievements' },
  { id: 'settings', labelKey: 'settings' },
];

interface NavMoreSheetProps {
  open: boolean;
  locale: Locale;
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
  onClose: () => void;
}

export function NavMoreSheet({ open, locale, activeTab, onSelect, onClose }: NavMoreSheetProps) {
  if (!open) return null;

  return (
    <div className="nav-more-backdrop" role="presentation" onClick={onClose}>
      <div className="nav-more-sheet" onClick={(e) => e.stopPropagation()} role="menu">
        <div className="nav-more-dots" aria-hidden="true">
          <span className="nav-more-dot nav-more-dot--active" />
          <span className="nav-more-dot" />
        </div>
        {MORE_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={`nav-more-item${activeTab === item.id ? ' active' : ''}`}
            onClick={() => {
              onSelect(item.id);
              onClose();
            }}
          >
            <span className="nav-more-icon" aria-hidden="true">
              <NavIcon tab={item.id} />
            </span>
            <span>{t(item.labelKey, locale)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function isMoreSubTab(tab: TabId): boolean {
  return tab === 'mistakes' || tab === 'achievements' || tab === 'settings';
}
