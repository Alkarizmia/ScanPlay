export type InstallPlatform = 'ios' | 'android' | 'other';

export function getInstallPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  if (/ipad|iphone|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'other';
}

export function isStandaloneApp(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Instagram, Facebook, etc. — l’installation PWA n’est pas possible. */
export function isInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  return (
    /FBAN|FBAV|Instagram|Line\//i.test(ua) ||
    (/Twitter/i.test(ua) && /Mobile/i.test(ua)) ||
    /Snapchat/i.test(ua)
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const register = () =>
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    const registration =
      document.readyState === 'complete' ? await register() : await new Promise<ServiceWorkerRegistration>((resolve, reject) => {
        window.addEventListener(
          'load',
          () => {
            register().then(resolve).catch(reject);
          },
          { once: true },
        );
      });
    void registration.update();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated' && navigator.serviceWorker.controller) {
          window.location.reload();
        }
      });
    });
    return registration;
  } catch {
    return null;
  }
}
