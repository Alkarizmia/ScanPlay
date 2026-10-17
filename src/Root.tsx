import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { FluentEmojiPreview } from './components/FluentEmojiPreview';
import { LandingPage } from './components/landing/LandingPage';
import { applyDeviceAttributes, detectDeviceProfile } from './lib/device';
import { hasStoredAuthSession } from './lib/authSessionHint';
import {
  applyUrlBootIntent,
  peekPendingProfileName,
  setBootIntent,
  setBootLocale,
} from './lib/bootIntent';
import { initialLandingLang, persistLandingLang, type LandingLang } from './lib/landingI18n';
import type { Locale } from './types';

const App = lazy(() => import('./App'));

function isFluentPreviewQuery(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('fluent') === 'preview';
  } catch {
    return false;
  }
}

export function Root() {
  const [showApp, setShowApp] = useState(() => {
    const fromUrl = applyUrlBootIntent();
    const profileLink = Boolean(peekPendingProfileName());
    return Boolean(fromUrl) || profileLink || hasStoredAuthSession();
  });
  const [device, setDevice] = useState(() => detectDeviceProfile());
  /** Locale chosen on the landing; passed into App so Strict Mode cannot drop it. */
  const [appLocale, setAppLocale] = useState<Locale>(() => initialLandingLang());

  useEffect(() => {
    applyDeviceAttributes(device);
  }, [device]);

  useEffect(() => {
    const onResize = () => setDevice(detectDeviceProfile());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const openApp = useCallback((intent: 'scan' | 'auth', lang?: LandingLang) => {
    const chosen = lang ?? initialLandingLang();
    persistLandingLang(chosen);
    setBootLocale(chosen);
    setAppLocale(chosen);
    setBootIntent(intent);
    setShowApp(true);
  }, []);

  if (isFluentPreviewQuery()) {
    return <FluentEmojiPreview />;
  }

  if (showApp) {
    return (
      <Suspense fallback={<div className="auth-session-boot" aria-busy="true" />}>
        <App initialLocale={appLocale} />
      </Suspense>
    );
  }

  return (
    <LandingPage
      locale={appLocale}
      device={device}
      onScanPlay={(lang) => openApp('scan', lang)}
      onAuth={(lang) => openApp('auth', lang)}
      onLangChange={(lang) => {
        persistLandingLang(lang);
        setAppLocale(lang);
      }}
    />
  );
}
