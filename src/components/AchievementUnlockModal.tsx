import { useEffect, useState } from 'react';
import { Confetti } from './Confetti';
import { t } from '../lib/i18n';
import type { AchievementDef } from '../lib/achievements';
import type { Locale } from '../types';

interface AchievementUnlockModalProps {
  achievement: AchievementDef | null;
  locale: Locale;
  onDismiss: () => void;
}

export function AchievementUnlockModal({ achievement, locale, onDismiss }: AchievementUnlockModalProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (achievement) {
      setShow(true);
      const tmr = window.setTimeout(() => {
        setShow(false);
        onDismiss();
      }, 2800);
      return () => clearTimeout(tmr);
    }
    setShow(false);
    return undefined;
  }, [achievement, onDismiss]);

  if (!achievement) return null;

  return (
    <div
      className={`achievement-unlock-overlay ${show ? 'visible' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-title"
      onClick={onDismiss}
    >
      <Confetti active={show} />
      <div className="achievement-unlock-card" onClick={(e) => e.stopPropagation()}>
        <p className="achievement-unlock-kicker">{t('achievementUnlocked', locale)}</p>
        <span className="achievement-unlock-icon bounce" aria-hidden="true">
          {achievement.icon}
        </span>
        <h3 id="unlock-title" className="achievement-unlock-name">
          {t(achievement.nameKey, locale)}
        </h3>
        <p className="achievement-unlock-desc">{t(achievement.descKey, locale)}</p>
        <button type="button" className="btn-primary" onClick={onDismiss}>
          {t('achievementUnlockContinue', locale)}
        </button>
      </div>
    </div>
  );
}
