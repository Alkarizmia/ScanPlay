import { t } from '../../lib/i18n';
import type { Locale } from '../../types';

interface IdleHelpChipProps {
  locale: Locale;
  helped: boolean;
  secondsLeft: number | null;
  /** Tap while counting down to reveal the hint immediately. */
  onSkip?: () => void;
}

/** Soft countdown → tap to skip wait, or “help is here” once ready. */
export function IdleHelpChip({ locale, helped, secondsLeft, onSkip }: IdleHelpChipProps) {
  if (!helped) {
    if (secondsLeft == null || secondsLeft > 9) return null;
  }

  if (helped) {
    return (
      <div className="idle-help-chip idle-help-chip--ready" aria-live="polite">
        <span className="idle-help-chip-ring" aria-hidden="true" />
        {t('idleHelpReady', locale)}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="idle-help-chip idle-help-chip--skip"
      onClick={() => onSkip?.()}
      aria-label={t('idleHelpSkip', locale)}
    >
      <span className="idle-help-chip-ring" aria-hidden="true" />
      <span className="idle-help-chip-soon">
        {t('idleHelpSoon', locale).replace('{n}', String(Math.max(1, secondsLeft ?? 1)))}
      </span>
      <span className="idle-help-chip-skip-label">{t('idleHelpSkip', locale)}</span>
    </button>
  );
}
