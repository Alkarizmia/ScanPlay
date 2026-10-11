import { t, type TranslationKey } from '../lib/i18n';
import type { DeviceKind } from '../lib/device';
import { LogoWordmark } from './Logo';
import { NavIcon } from './icons/NavIcon';
import { isMoreSubTab, MORE_ITEMS, UniverseNavIcon } from './NavMoreSheet';
import type { Locale, TabId } from '../types';

interface BottomNavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  locale: Locale;
  device: DeviceKind;
  moreOpen?: boolean;
  onMoreToggle?: () => void;
  universeActive?: boolean;
  onOpenUniverse?: () => void;
}

const MAIN_TABS: { id: TabId; labelKey: TranslationKey }[] = [
  { id: 'home', labelKey: 'home' },
  { id: 'history', labelKey: 'history' },
  { id: 'chat', labelKey: 'chatTitle' },
  { id: 'friends', labelKey: 'friends' },
];

function navHighlight(tab: TabId, moreOpen: boolean, desktop: boolean): TabId {
  if (desktop) return tab;
  if (moreOpen || isMoreSubTab(tab) || tab === 'more') return 'more';
  return tab;
}

export function BottomNav({
  active,
  onChange,
  locale,
  device,
  moreOpen = false,
  onMoreToggle,
  universeActive = false,
  onOpenUniverse,
}: BottomNavProps) {
  const desktop = device === 'desktop';
  const highlight = navHighlight(active, moreOpen, desktop);

  return (
    <nav className={`app-nav bottom-nav bottom-nav--${device}`} aria-label="Main navigation">
      {desktop && (
        <div className="side-nav-brand">
          <LogoWordmark variant="sidebar" />
        </div>
      )}

      <div className={`bottom-nav-items${desktop ? '' : ' bottom-nav-items--five'}`}>
        {MAIN_TABS.map((tab) => {
          const isActive = !universeActive && highlight === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`bottom-nav-item${isActive ? ' active' : ''}`}
              onClick={() => {
                if (moreOpen) onMoreToggle?.();
                if (isActive) return;
                onChange(tab.id);
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="bottom-nav-icon" aria-hidden="true">
                <NavIcon tab={tab.id} />
              </span>
              <span className="bottom-nav-label">{t(tab.labelKey, locale)}</span>
            </button>
          );
        })}

        {!desktop && (
          <button
            type="button"
            className={`bottom-nav-item${highlight === 'more' ? ' active' : ''}${moreOpen ? ' bottom-nav-item--more-open' : ''}`}
            onClick={() => onMoreToggle?.()}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            aria-label={t('navMore', locale)}
          >
            <span className="bottom-nav-icon" aria-hidden="true">
              <NavIcon tab="more" />
            </span>
            <span className="bottom-nav-label">{t('navMore', locale)}</span>
          </button>
        )}
      </div>

      {desktop && (
        <div className="side-nav-quick" aria-label={t('navMoreTitle', locale)}>
          <p className="side-nav-quick-title">{t('navMoreTitle', locale)}</p>
          {MORE_ITEMS.map((item) => {
            const key = item.kind === 'tab' ? item.id : 'universe';
            const isActive = item.kind === 'tab' ? !universeActive && active === item.id : universeActive;
            return (
              <button
                key={key}
                type="button"
                className={`bottom-nav-item side-nav-quick-item${isActive ? ' active' : ''}`}
                onClick={() => {
                  if (item.kind === 'universe') onOpenUniverse?.();
                  else onChange(item.id);
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="bottom-nav-icon" aria-hidden="true">
                  {item.kind === 'universe' ? <UniverseNavIcon /> : <NavIcon tab={item.id} />}
                </span>
                <span className="bottom-nav-label">{t(item.labelKey, locale)}</span>
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
