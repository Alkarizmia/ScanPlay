import { ProfileSection } from './ProfileSection';
import { SubscriptionSection } from './SubscriptionSection';
import { AccountPasswordSection } from './AccountPasswordSection';
import { PrivacyPolicySheet } from './PrivacyPolicySheet';
import { AudioSettingsScreen } from './AudioSettingsScreen';
import { useMemo, useState } from 'react';
import { getUser, signOut } from '../lib/auth';
import { DeviceBadge } from './DeviceBadge';
import type { DeviceProfile } from '../lib/device';
import { t } from '../lib/i18n';
import { setPreference } from '../lib/preferences';
import { usePlan } from '../hooks/usePlan';
import { planLabel, setPlan } from '../lib/planLimits';
import { isStripeCheckoutEnabled } from '../lib/stripeCheckout';
import { usePreferences } from '../hooks/usePreferences';
import { useTheme } from '../hooks/useTheme';
import { playSound } from '../lib/sounds';
import { LOCALES, type Locale, type Plan } from '../types';

interface SettingsScreenProps {
  locale: Locale;
  device: DeviceProfile;
  refreshKey: number;
  isLoggedIn: boolean;
  onLocaleChange: (locale: Locale) => void;
  onAuth: () => void;
  onLogout: () => void;
  onPricing: () => void;
  onRefresh: () => void;
  onToast?: (message: string) => void;
  highlightPasswordRecovery?: boolean;
  onPasswordHighlightDone?: () => void;
}

export function SettingsScreen({
  locale,
  device,
  refreshKey,
  isLoggedIn,
  onLocaleChange,
  onAuth,
  onLogout,
  onPricing,
  onRefresh,
  onToast,
  highlightPasswordRecovery = false,
  onPasswordHighlightDone,
}: SettingsScreenProps) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const user = getUser();
  const plan = usePlan();
  const effectivePlan = isLoggedIn ? plan : 'free';
  const prefs = usePreferences();
  const showDev = useMemo(
    () =>
      !isStripeCheckoutEnabled() &&
      new URLSearchParams(window.location.search).get('dev') === '1',
    [],
  );

  const handlePlanDev = (p: Plan) => {
    if (!isLoggedIn) return;
    setPlan(p);
    onRefresh();
  };

  const handleLogout = async () => {
    await signOut();
    onLogout();
  };

  const updatePref = <K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) => {
    const prev = prefs[key];
    setPreference(key, value);
    if (key === 'sound') {
      if (value && !prev) playSound('tap');
    }
  };

  if (audioOpen) {
    return <AudioSettingsScreen locale={locale} onBack={() => setAudioOpen(false)} />;
  }

  return (
    <div className="screen tab-screen">
      <header className="top-bar">
        <h2 className="screen-title">{t('settingsTitle', locale)}</h2>
      </header>

      <main className="settings-main scroll-natural">
        {isLoggedIn ? (
          <ProfileSection
            locale={locale}
            refreshKey={refreshKey}
            onRefresh={onRefresh}
            onUpgrade={onPricing}
            onToast={onToast}
          />
        ) : (
          <>
            <section className="settings-section profile-section profile-section--guest">
              <h3 className="settings-label">{t('profileSection', locale)}</h3>
              <div className="profile-card profile-card--guest">
                <div className="profile-guest-preview">
                  <span className="profile-avatar-preview profile-avatar-preview--guest" aria-hidden="true">
                    <span className="profile-avatar-emoji">👤</span>
                  </span>
                  <p className="profile-guest-text">{t('accountLoginHint', locale)}</p>
                </div>
                <button type="button" className="btn-primary btn-lg" onClick={onAuth}>
                  {t('connect', locale)}
                </button>
              </div>
            </section>
            <SubscriptionSection
              locale={locale}
              isLoggedIn={false}
              onPricing={onPricing}
              onAuth={onAuth}
            />
          </>
        )}

        <section className="settings-section">
          <h3 className="settings-label">{t('account', locale)}</h3>
          {isLoggedIn ? (
            <>
              <div className="settings-row">
                <span className="account-email">{user.email}</span>
              </div>
              <AccountPasswordSection
                locale={locale}
                highlight={highlightPasswordRecovery}
                onHighlightDone={onPasswordHighlightDone}
              />
              <button type="button" className="btn-danger btn-sm" onClick={() => void handleLogout()}>
                {t('logout', locale)}
              </button>
            </>
          ) : (
            <div className="account-guest-card">
              <p className="account-guest-text">{t('accountLoginHint', locale)}</p>
              <button type="button" className="btn-primary" onClick={onAuth}>
                {t('connect', locale)}
              </button>
            </div>
          )}
        </section>

        {!isLoggedIn && (
          <section className="settings-section stats-section stats-section--empty">
            <h3 className="settings-label">{t('statsTitle', locale)}</h3>
            <p className="stats-login-hint">{t('statsLoginHint', locale)}</p>
          </section>
        )}

        <section className="settings-section">
          <h3 className="settings-label">{t('experienceSection', locale)}</h3>
          <div className="settings-theme-toggle">
            <button
              type="button"
              className={`settings-theme-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              {t('themeDark', locale)}
            </button>
            <button
              type="button"
              className={`settings-theme-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
            >
              {t('themeLight', locale)}
            </button>
          </div>
          <div className="settings-row">
            <span>{prefs.sound ? t('soundOn', locale) : t('soundOff', locale)}</span>
            <button
              type="button"
              className={`toggle ${prefs.sound ? 'on' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                updatePref('sound', !prefs.sound);
              }}
              role="switch"
              aria-checked={prefs.sound}
              aria-label={prefs.sound ? t('soundOn', locale) : t('soundOff', locale)}
            />
          </div>
          <button type="button" className="btn-secondary audio-settings-link" onClick={() => setAudioOpen(true)}>
            🔊 {t('openAudioSettings', locale)}
          </button>
          <div className="settings-row">
            <span>{prefs.notifications ? t('notificationsOn', locale) : t('notificationsOff', locale)}</span>
            <button
              type="button"
              className={`toggle ${prefs.notifications ? 'on' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                updatePref('notifications', !prefs.notifications);
              }}
              role="switch"
              aria-checked={prefs.notifications}
              aria-label={
                prefs.notifications ? t('notificationsOn', locale) : t('notificationsOff', locale)
              }
            />
          </div>
          <div className="settings-row">
            <span>{t('language', locale)}</span>
            <select
              className="settings-select"
              value={locale}
              onChange={(e) => onLocaleChange(e.target.value as Locale)}
            >
              {LOCALES.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="settings-section">
          <h3 className="settings-label">{t('deviceMode', locale)}</h3>
          <div className="settings-row settings-row-device">
            <DeviceBadge locale={locale} profile={device} />
          </div>
          <p className="settings-device-hint">
            {device.kind === 'desktop' ? t('deviceHintDesktop', locale) : t('deviceHintMobile', locale)}
          </p>
        </section>

        <section className="settings-section">
          <h3 className="settings-label">{t('privacySection', locale)}</h3>
          <p className="settings-hint">{t('privacyIntro', locale)}</p>
          <button type="button" className="btn-secondary" onClick={() => setPrivacyOpen(true)}>
            {t('privacyOpen', locale)}
          </button>
        </section>

        <section className="settings-section">
          <h3 className="settings-label">{t('about', locale)}</h3>
          <p className="about-text">{t('aboutText', locale)}</p>
        </section>

        {isLoggedIn && showDev && (
          <section className="settings-section dev-section">
            <h3 className="settings-label">{t('devPlan', locale)}</h3>
            <div className="dev-plans">
              {(['free', 'plus', 'pro'] as Plan[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`dev-plan-btn ${effectivePlan === p ? 'active' : ''}`}
                  onClick={() => handlePlanDev(p)}
                >
                  {planLabel(p)}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <PrivacyPolicySheet open={privacyOpen} locale={locale} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}
