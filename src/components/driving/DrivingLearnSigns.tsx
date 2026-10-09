import { useMemo, useState } from 'react';
import { DRIVING_SIGNS } from '../../lib/drivingBelgium';
import { DRIVING_FAMILY_ORDER } from '../../lib/drivingSignsCatalog';
import { markDrivingSignLearned } from '../../lib/universeDriving';
import { DrivingSignArt } from './DrivingSignArt';
import { playSound } from '../../lib/sounds';
import { t } from '../../lib/i18n';
import type { Locale } from '../../types';

interface DrivingLearnSignsProps {
  locale: Locale;
  onExit: () => void;
}

type FamilyFilter = 'all' | (typeof DRIVING_FAMILY_ORDER)[number];

/** Knowledge-only: browse official Belgian signs by family. No hearts lost. */
export function DrivingLearnSigns({ locale, onExit }: DrivingLearnSignsProps) {
  const [family, setFamily] = useState<FamilyFilter>('all');
  const deck = useMemo(
    () => (family === 'all' ? DRIVING_SIGNS : DRIVING_SIGNS.filter((s) => s.family === family)),
    [family],
  );
  const [index, setIndex] = useState(0);
  const sign = deck[index];
  const total = deck.length;
  const pct = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;

  const setFamilyFilter = (next: FamilyFilter) => {
    playSound('tap');
    setFamily(next);
    setIndex(0);
  };

  const go = (next: number) => {
    if (!sign) return;
    playSound('tap');
    markDrivingSignLearned(sign.id);
    setIndex(Math.max(0, Math.min(total - 1, next)));
  };

  const onNext = () => {
    if (!sign) return;
    markDrivingSignLearned(sign.id);
    if (index >= total - 1) {
      playSound('perfect');
      onExit();
      return;
    }
    playSound('tap');
    setIndex(index + 1);
  };

  if (!sign || total === 0) {
    return (
      <div className="driving-play driving-play--learn">
        <header className="driving-play-bar">
          <button type="button" className="driving-play-x" onClick={onExit} aria-label={t('back', locale)}>
            ✕
          </button>
          <p className="driving-play-progress">{t('driveLearnEmpty', locale)}</p>
          <span className="driving-play-bar-spacer" />
        </header>
      </div>
    );
  }

  return (
    <div className="driving-play driving-play--learn">
      <header className="driving-play-bar">
        <button type="button" className="driving-play-x" onClick={onExit} aria-label={t('back', locale)}>
          ✕
        </button>
        <div className="driving-play-progress-wrap">
          <p className="driving-play-progress">
            {t('driveLearnProgress', locale)
              .replace('{n}', String(index + 1))
              .replace('{total}', String(total))}
          </p>
          <div className="driving-xp-track" aria-hidden="true">
            <span className="driving-xp-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="driving-learn-badge">{t('driveModeLearnKicker', locale)}</span>
      </header>

      <div className="driving-family-tabs" role="tablist" aria-label={t('driveFamiliesLabel', locale)}>
        <button
          type="button"
          role="tab"
          className={`driving-family-tab${family === 'all' ? ' is-active' : ''}`}
          aria-selected={family === 'all'}
          onClick={() => setFamilyFilter('all')}
        >
          {t('driveFamilyAll', locale)}
        </button>
        {DRIVING_FAMILY_ORDER.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            className={`driving-family-tab${family === f ? ' is-active' : ''}`}
            aria-selected={family === f}
            onClick={() => setFamilyFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="driving-learn-stage">
        <div className="driving-learn-card" key={sign.id}>
          <div className="driving-learn-sign-glow" aria-hidden="true" />
          <DrivingSignArt id={sign.id} className="driving-learn-sign" />
          <p className="driving-learn-code">
            {sign.code ?? sign.id} · {t(`driveCat_${sign.category}`, locale)}
          </p>
          <h2 className="driving-learn-title">{sign.title}</h2>
          <p className="driving-learn-meaning">{sign.meaning}</p>
        </div>
      </div>

      <footer className="driving-play-footer">
        <button type="button" className="btn-secondary" disabled={index === 0} onClick={() => go(index - 1)}>
          {t('drivePrev', locale)}
        </button>
        <button type="button" className="driving-validate-btn" onClick={onNext}>
          {index >= total - 1 ? t('driveLearnDone', locale) : t('driveNext', locale)}
        </button>
      </footer>
    </div>
  );
}
