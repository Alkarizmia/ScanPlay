import { t, type TranslationKey } from '../lib/i18n';
import { NavIcon } from './icons/NavIcon';
import type { Locale, TabId } from '../types';

type MoreItem =
  | { kind: 'tab'; id: TabId; labelKey: TranslationKey }
  | { kind: 'universe'; labelKey: TranslationKey };

/** Profile + Compte shortcuts (direct access). */
const MORE_ITEMS: MoreItem[] = [
  { kind: 'tab', id: 'profile', labelKey: 'profileTitle' },
  { kind: 'tab', id: 'settings', labelKey: 'settings' },
  { kind: 'universe', labelKey: 'pixUniverseTitle' },
  { kind: 'tab', id: 'shop', labelKey: 'shopTitle' },
  { kind: 'tab', id: 'mistakes', labelKey: 'mistakes' },
  { kind: 'tab', id: 'achievements', labelKey: 'achievements' },
];

function UniverseNavIcon() {
  return (
    <svg className="nav-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <ellipse cx="12" cy="12" rx="8.5" ry="3.2" />
      <path d="M12 3.5v17" />
      <path d="M5.2 8.2c2.2 1.4 4.5 2.1 6.8 2.1s4.6-.7 6.8-2.1" />
      <path d="M5.2 15.8c2.2-1.4 4.5-2.1 6.8-2.1s4.6.7 6.8 2.1" />
    </svg>
  );
}

interface NavMoreSheetProps {
  open: boolean;
  locale: Locale;
  activeTab: TabId;
  universeActive?: boolean;
  onSelect: (tab: TabId) => void;
  onOpenUniverse: () => void;
  onClose: () => void;
}

export function NavMoreSheet({
  open,
  locale,
  activeTab,
  universeActive = false,
  onSelect,
  onOpenUniverse,
  onClose,
}: NavMoreSheetProps) {
  if (!open) return null;

  return (
    <div className="nav-more-backdrop" role="presentation" onClick={onClose}>
      <div className="nav-more-sheet" onClick={(e) => e.stopPropagation()} role="menu" aria-label={t('navMore', locale)}>
        <div className="nav-more-handle" aria-hidden="true" />
        <p className="nav-more-title">{t('navMoreTitle', locale)}</p>
        {MORE_ITEMS.map((item) => {
          const key = item.kind === 'tab' ? item.id : 'universe';
          const active = item.kind === 'tab' ? activeTab === item.id : universeActive;
          return (
            <button
              key={key}
              type="button"
              role="menuitem"
              className={`nav-more-item${active ? ' active' : ''}`}
              onClick={() => {
                if (item.kind === 'universe') onOpenUniverse();
                else onSelect(item.id);
                onClose();
              }}
            >
              <span className="nav-more-icon" aria-hidden="true">
                {item.kind === 'universe' ? <UniverseNavIcon /> : <NavIcon tab={item.id} />}
              </span>
              <span className="nav-more-label">{t(item.labelKey, locale)}</span>
              <span className="nav-more-chevron" aria-hidden="true">
                ›
              </span>
            </button>
          );
        })}
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
