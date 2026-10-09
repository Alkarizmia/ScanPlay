import { t, type TranslationKey } from '../lib/i18n';
import { NavIcon } from './icons/NavIcon';
import type { Locale, TabId } from '../types';

/** Profile + Compte shortcuts (direct access). */
const MORE_ITEMS: { id: TabId; labelKey: TranslationKey }[] = [
  { id: 'profile', labelKey: 'profileTitle' },
  { id: 'settings', labelKey: 'settings' },
  { id: 'shop', labelKey: 'shopTitle' },
  { id: 'mistakes', labelKey: 'mistakes' },
  { id: 'achievements', labelKey: 'achievements' },
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
      <div className="nav-more-sheet" onClick={(e) => e.stopPropagation()} role="menu" aria-label={t('navMore', locale)}>
        <div className="nav-more-handle" aria-hidden="true" />
        <p className="nav-more-title">{t('navMoreTitle', locale)}</p>
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
            <span className="nav-more-label">{t(item.labelKey, locale)}</span>
            <span className="nav-more-chevron" aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function isMoreSubTab(tab: TabId): boolean {
  return (
    tab === 'profile' ||
    tab === 'mistakes' ||
    tab === 'achievements' ||
    tab === 'settings' ||
    tab === 'shop'
  );
}
