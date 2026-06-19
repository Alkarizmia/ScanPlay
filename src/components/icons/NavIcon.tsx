import type { ReactElement } from 'react';
import type { TabId } from '../../types';

type IconPath = ReactElement;

const paths: Record<TabId, IconPath> = {
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </>
  ),
  history: (
    <>
      <path d="M8 6h12M8 12h12M8 18h8" />
      <rect x="4" y="5" width="2" height="2" rx="0.5" />
      <rect x="4" y="11" width="2" height="2" rx="0.5" />
      <rect x="4" y="17" width="2" height="2" rx="0.5" />
    </>
  ),
  friends: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  shop: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v10M9 10h6M9 14h4" />
    </>
  ),
  mistakes: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 8l8 8M16 8l-8 8" />
    </>
  ),
  achievements: (
    <>
      <path d="M8 4h8l1 4-5 3-5-3 1-4Z" />
      <path d="M12 11v9" />
      <path d="M8 20h8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
};

interface NavIconProps {
  tab: TabId;
  className?: string;
}

export function NavIcon({ tab, className = 'nav-icon-svg' }: NavIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {paths[tab]}
    </svg>
  );
}
