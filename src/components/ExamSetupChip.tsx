import { t } from '../lib/i18n';
import { hasFeature } from '../lib/planLimits';
import type { Locale } from '../types';

interface ExamSetupChipProps {
  locale: Locale;
  examMode: boolean;
  onToggle: () => void;
  onUpgrade: () => void;
  lockedByProgress?: boolean;
}

/** Option examen discrète pour l’écran « Prépare ton parcours » (et replay historique). */
export function ExamSetupChip({
  locale,
  examMode,
  onToggle,
  onUpgrade,
  lockedByProgress = false,
}: ExamSetupChipProps) {
  const unlocked = hasFeature('exam');

  const handleClick = () => {
    if (!unlocked) {
      onUpgrade();
      return;
    }
    if (lockedByProgress) return;
    onToggle();
  };

  return (
    <button
      type="button"
      className={`exam-setup-chip${examMode && unlocked ? ' exam-setup-chip--on' : ''}`}
      onClick={handleClick}
      aria-pressed={unlocked && examMode}
      disabled={unlocked && lockedByProgress}
    >
      <span className="exam-setup-chip-label">{t('examMode', locale)}</span>
      <span className="exam-setup-chip-hint">
        {unlocked
          ? examMode
            ? t('examSetupOn', locale)
            : lockedByProgress
              ? t('examLockedHint', locale)
              : t('examSetupOff', locale)
          : t('examSetupHint', locale)}
      </span>
    </button>
  );
}
