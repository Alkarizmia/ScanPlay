import { useCallback, useEffect, useState } from 'react';
import { trackEvent } from '../lib/analytics';
import {
  getInstallPlatform,
  isInAppBrowser,
  isStandaloneApp,
  type InstallPlatform,
} from '../lib/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneApp);
  const [platform] = useState<InstallPlatform>(() => getInstallPlatform());
  const [inAppBrowser] = useState(isInAppBrowser);

  useEffect(() => {
    const syncInstalled = () => {
      if (isStandaloneApp()) setIsInstalled(true);
    };

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      trackEvent('install_reussie');
      void import('../lib/sync').then((m) => m.reportPwaInstalled()).catch(() => {});
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    document.addEventListener('visibilitychange', syncInstalled);

    if (isStandaloneApp()) {
      void import('../lib/sync').then((m) => m.reportPwaInstalled()).catch(() => {});
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      document.removeEventListener('visibilitychange', syncInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstalled(true);
      void import('../lib/sync').then((m) => m.reportPwaInstalled()).catch(() => {});
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const canNativeInstall = Boolean(deferredPrompt) && !isInstalled;
  const canShowInstall = !isInstalled && !inAppBrowser;

  return {
    canNativeInstall,
    canShowInstall,
    isInstalled,
    install,
    platform,
    isInAppBrowser: inAppBrowser,
  };
}
