import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { LandingPage } from './components/landing/LandingPage';
import { applyDeviceAttributes, detectDeviceProfile } from './lib/device';
import { hasStoredAuthSession } from './lib/authSessionHint';
import { setBootIntent } from './lib/bootIntent';
import { landingLangFromNavigator } from './lib/landingI18n';

const App = lazy(() => import('./App'));

export function Root() {
  const [showApp, setShowApp] = useState(() => hasStoredAuthSession());
  const [device, setDevice] = useState(() => detectDeviceProfile());
  const locale = useMemo(() => landingLangFromNavigator(), []);

  useEffect(() => {
    applyDeviceAttributes(device);
  }, [device]);

  useEffect(() => {
    const onResize = () => setDevice(detectDeviceProfile());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const openApp = useCallback((intent: 'scan' | 'auth') => {
    setBootIntent(intent);
    setShowApp(true);
  }, []);

  if (showApp) {
    return (
      <Suspense fallback={<div className="auth-session-boot" aria-busy="true" />}>
        <App />
      </Suspense>
    );
  }

  return (
    <LandingPage
      locale={locale}
      device={device}
      onScanPlay={() => openApp('scan')}
      onAuth={() => openApp('auth')}
    />
  );
}
