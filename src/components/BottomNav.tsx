import { t, type TranslationKey } from '../lib/i18n';
import type { DeviceKind } from '../lib/device';
import { LogoWordmark } from './Logo';
import { NavIcon } from './icons/NavIcon';
import type { Locale, TabId } from '../types';

interface BottomNavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  locale: Locale;
  device: DeviceKind;
}

const TABS: { id: TabId; labelKey: TranslationKey }[] = [
  { id: 'home', labelKey: 'home' },
  { id: 'history', labelKey: 'history' },
  { id: 'friends', labelKey: 'friends' },
  { id: 'shop', labelKey: 'shop' },
  { id: 'mistakes', labelKey: 'mistakes' },
  { id: 'achievements', labelKey: 'achievements' },
  { id: 'settings', labelKey: 'settings' },
];

export function BottomNav({ active, onChange, locale, device }: BottomNavProps) {
  return (
    <nav className={`app-nav bottom-nav bottom-nav--${device}`} aria-label="Main navigation">
      {device === 'desktop' && (
        <div className="side-nav-brand">
          <LogoWordmark variant="sidebar" />
        </div>
      )}

      <div className="bottom-nav-items">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`bottom-nav-item ${active === tab.id ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
            aria-current={active === tab.id ? 'page' : undefined}
          >
            <span className="bottom-nav-icon" aria-hidden="true">
              <NavIcon tab={tab.id} />
            </span>
            <span className="bottom-nav-label">{t(tab.labelKey, locale)}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
