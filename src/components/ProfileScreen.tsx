import { ProfileSection } from './ProfileSection';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface ProfileScreenProps {
  locale: Locale;
  refreshKey: number;
  isLoggedIn: boolean;
  onRefresh: () => void;
  onUpgrade: () => void;
  onAuth: () => void;
  onToast?: (message: string) => void;
}

export function ProfileScreen({
  locale,
  refreshKey,
  isLoggedIn,
  onRefresh,
  onUpgrade,
  onAuth,
  onToast,
}: ProfileScreenProps) {
  return (
    <div className="screen tab-screen profile-screen">
      <header className="top-bar profile-top-bar">
        <h2 className="screen-title">{t('profileTitle', locale)}</h2>
      </header>
      <main className="profile-main scroll-natural">
        {isLoggedIn ? (
          <ProfileSection
            locale={locale}
            refreshKey={refreshKey}
            onRefresh={onRefresh}
            onUpgrade={onUpgrade}
            onToast={onToast}
            variant="page"
          />
        ) : (
          <div className="profile-guest-card">
            <p>{t('profileGuestHint', locale)}</p>
            <button type="button" className="btn-primary" onClick={onAuth}>
              {t('connect', locale)}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
