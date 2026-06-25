import { t, type TranslationKey } from '../lib/i18n';
import type { DeviceKind } from '../lib/device';
import { LogoWordmark } from './Logo';
import { NavIcon } from './icons/NavIcon';
import { isMoreSubTab } from './NavMoreSheet';
import type { Locale, TabId } from '../types';

interface BottomNavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  locale: Locale;
  device: DeviceKind;
  moreOpen?: boolean;
  onMoreToggle?: () => void;
}

const MAIN_TABS: { id: TabId; labelKey: TranslationKey }[] = [
  { id: 'home', labelKey: 'home' },
  { id: 'shop', labelKey: 'navChest' },
  { id: 'friends', labelKey: 'friends' },
  { id: 'history', labelKey: 'history' },
  { id: 'profile', labelKey: 'profileTitle' },
  { id: 'more', labelKey: 'navMore' },
];

function navHighlight(tab: TabId): TabId {
  if (isMoreSubTab(tab)) return 'more';
  return tab;
}

export function BottomNav({ active, onChange, locale, device, moreOpen, onMoreToggle }: BottomNavProps) {
  const highlight = navHighlight(active);

  return (
    <nav className={`app-nav bottom-nav bottom-nav--${device}`} aria-label="Main navigation">
      {device === 'desktop' && (
        <div className="side-nav-brand">
          <LogoWordmark variant="sidebar" />
        </div>
      )}

      <div className="bottom-nav-items bottom-nav-items--six">
        {MAIN_TABS.map((tab) => {
          const isMore = tab.id === 'more';
          const isActive = isMore ? highlight === 'more' : highlight === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`bottom-nav-item${isActive ? ' active' : ''}${isMore && moreOpen ? ' bottom-nav-item--more-open' : ''}`}
              onClick={() => {
                if (isMore && onMoreToggle) onMoreToggle();
                else onChange(tab.id);
              }}
              aria-current={isActive ? 'page' : undefined}
              aria-expanded={isMore ? moreOpen : undefined}
            >
              <span className="bottom-nav-icon" aria-hidden="true">
                <NavIcon tab={tab.id} />
              </span>
              <span className="bottom-nav-label">{t(tab.labelKey, locale)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
