import { ScanPlayMascot } from './mascot/ScanPlayMascot';
import { getGamification, getLevel } from '../lib/gamification';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface CoachFabProps {
  locale: Locale;
  onOpen: () => void;
}

/** Compact Pix shortcut — exterior chrome screens only (path / results), bottom-right. */
export function CoachFab({ locale, onOpen }: CoachFabProps) {
  const level = getLevel(getGamification().xp);

  return (
    <button
      type="button"
      className="coach-fab"
      onClick={onOpen}
      aria-label={t('chatTitle', locale)}
    >
      <span className="coach-fab-orb" aria-hidden="true">
        <ScanPlayMascot expression="encouraging" size={36} idle level={level} />
        <span className="coach-fab-badge">
          <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
            <path
              d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H10l-4.2 3.2c-.6.45-1.3-.08-1.15-.8L5.5 15H6.5A2.5 2.5 0 0 1 4 12.5v-7Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </span>
    </button>
  );
}
