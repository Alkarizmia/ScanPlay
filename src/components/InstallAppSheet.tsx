import { createPortal } from 'react-dom';
import { t } from '../lib/i18n';
import type { InstallPlatform } from '../lib/pwa';
import type { Locale } from '../types';

interface InstallAppSheetProps {
  open: boolean;
  locale: Locale;
  platform: InstallPlatform;
  canNativeInstall: boolean;
  isInAppBrowser: boolean;
  onClose: () => void;
  onNativeInstall: () => Promise<boolean>;
}

export function InstallAppSheet({
  open,
  locale,
  platform,
  canNativeInstall,
  isInAppBrowser,
  onClose,
  onNativeInstall,
}: InstallAppSheetProps) {
  if (!open) return null;

  const steps =
    platform === 'ios'
      ? [t('installIosStep1', locale), t('installIosStep2', locale), t('installIosStep3', locale)]
      : [
          t('installAndroidStep1', locale),
          t('installAndroidStep2', locale),
          t('installAndroidStep3', locale),
        ];

  const handleNative = async () => {
    const ok = await onNativeInstall();
    if (ok) onClose();
  };

  return createPortal(
    <>
      <button
        type="button"
        className="install-sheet-backdrop"
        aria-label={t('back', locale)}
        onClick={onClose}
      />
      <div className="install-sheet" role="dialog" aria-labelledby="install-sheet-title">
        <h3 id="install-sheet-title" className="install-sheet-title">
          {t('installAppTitle', locale)}
        </h3>

        {isInAppBrowser ? (
          <p className="install-sheet-hint">{t('installInAppHint', locale)}</p>
        ) : (
          <>
            {canNativeInstall && platform === 'android' && (
              <button type="button" className="btn-primary btn-lg install-sheet-native" onClick={() => void handleNative()}>
                {t('installAndroidNativeBtn', locale)}
              </button>
            )}

            <ol className="install-sheet-steps">
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </>
        )}

        <button type="button" className="btn-secondary install-sheet-close" onClick={onClose}>
          {t('installAppClose', locale)}
        </button>
      </div>
    </>,
    document.body,
  );
}
