import { t } from '../../lib/i18n';
import type { Locale } from '../../types';

interface IdleHelpChipProps {
  locale: Locale;
  helped: boolean;
  secondsLeft: number | null;
}

/** Soft countdown → “help is here” so waiting 9s feels intentional, not failing. */
export function IdleHelpChip({ locale, helped, secondsLeft }: IdleHelpChipProps) {
  if (!helped) {
    if (secondsLeft == null || secondsLeft > 9) return null;
  }

  return (
    <div
      className={`idle-help-chip${helped ? ' idle-help-chip--ready' : ''}`}
      aria-live="polite"
    >
      <span className="idle-help-chip-ring" aria-hidden="true" />
      {helped
        ? t('idleHelpReady', locale)
        : t('idleHelpSoon', locale).replace('{n}', String(Math.max(1, secondsLeft ?? 1)))}
    </div>
  );
}
