import { useCallback, useEffect, useState } from 'react';
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
    const syncInstalled = () => setIsInstalled(isStandaloneApp());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    document.addEventListener('visibilitychange', syncInstalled);

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
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const canNativeInstall = Boolean(deferredPrompt) && !isInstalled;
  const canShowInstall =
    !isInstalled && (platform === 'ios' || platform === 'android') && !inAppBrowser;

  return {
    canNativeInstall,
    canShowInstall,
    isInstalled,
    install,
    platform,
    isInAppBrowser: inAppBrowser,
  };
}
