import { playSound } from '../../lib/sounds';
import { t } from '../../lib/i18n';
import type { Locale } from '../../types';

interface GameSkipFooterProps {
  locale: Locale;
  onSkip: () => void;
  disabled?: boolean;
}

export function GameSkipFooter({ locale, onSkip, disabled }: GameSkipFooterProps) {
  return (
    <footer className="game-skip-footer">
      <button
        type="button"
        className="btn-ghost btn-lg game-skip-btn"
        onClick={() => {
          playSound('tap');
          onSkip();
        }}
        disabled={disabled}
      >
        {t('gameSkip', locale)}
      </button>
    </footer>
  );
}
