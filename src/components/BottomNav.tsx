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
  { id: 'history', labelKey: 'history' },
  { id: 'friends', labelKey: 'friends' },
  { id: 'profile', labelKey: 'profileTitle' },
];

function navHighlight(tab: TabId): TabId {
  if (isMoreSubTab(tab) || tab === 'shop' || tab === 'more') return 'profile';
  return tab;
}

export function BottomNav({ active, onChange, locale, device }: BottomNavProps) {
  const highlight = navHighlight(active);

  return (
    <nav className={`app-nav bottom-nav bottom-nav--${device}`} aria-label="Main navigation">
      {device === 'desktop' && (
        <div className="side-nav-brand">
          <LogoWordmark variant="sidebar" />
        </div>
      )}

      <div className="bottom-nav-items bottom-nav-items--four">
        {MAIN_TABS.map((tab) => {
          const isActive = highlight === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`bottom-nav-item${isActive ? ' active' : ''}`}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
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
