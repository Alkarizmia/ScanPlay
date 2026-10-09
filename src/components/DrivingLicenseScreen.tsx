import { useState } from 'react';
import {
  DRIVING_COUNTRIES,
  clearDrivingCountrySelection,
  getDrivingCountryProgress,
  getUniverseDriving,
  selectDrivingCountry,
  type DrivingCountryId,
} from '../lib/universeDriving';
import { DRIVING_EXAM_SIZE, DRIVING_EXERCISE_SIZE, DRIVING_SIGNS } from '../lib/drivingBelgium';
import { DrivingCountryFlag, DrivingChevron } from './driving/DrivingCountryFlag';
import { DrivingSignArt } from './driving/DrivingSignArt';
import { DrivingLearnSigns } from './driving/DrivingLearnSigns';
import { DrivingQuizPlay, type DrivingQuizMode } from './driving/DrivingQuizPlay';
import { playSound } from '../lib/sounds';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface DrivingLicenseScreenProps {
  locale: Locale;
  refreshKey?: number;
  onHeartLost?: () => void;
  /** When true, parent already shows the store chrome; play modes go fullscreen. */
  onPlayModeChange?: (playing: boolean) => void;
}

type HubMode = 'hub' | 'learn' | 'exercise' | 'exam';

export function DrivingLicenseScreen({
  locale,
  refreshKey = 0,
  onHeartLost,
  onPlayModeChange,
}: DrivingLicenseScreenProps) {
  void refreshKey;
  const [, setRev] = useState(0);
  const [mode, setMode] = useState<HubMode>('hub');
  const profile = getUniverseDriving();
  const countryId = profile.countryId;
  const progress = countryId ? getDrivingCountryProgress(countryId, profile) : null;

  const enter = (next: HubMode) => {
    playSound('tap');
    setMode(next);
    onPlayModeChange?.(next !== 'hub');
  };

  const leavePlay = () => {
    setMode('hub');
    onPlayModeChange?.(false);
    setRev((n) => n + 1);
  };

  if (mode === 'learn') {
    return <DrivingLearnSigns locale={locale} onExit={leavePlay} />;
  }

  if (mode === 'exercise' || mode === 'exam') {
    const quizMode: DrivingQuizMode = mode;
    return (
      <DrivingQuizPlay
        locale={locale}
        mode={quizMode}
        onExit={leavePlay}
        onHeartLost={() => onHeartLost?.()}
        onFinished={() => setRev((n) => n + 1)}
      />
    );
  }

  const pickCountry = (id: DrivingCountryId, available: boolean) => {
    if (!available) {
      playSound('wrong');
      return;
    }
    playSound('tap');
    selectDrivingCountry(id);
    setRev((n) => n + 1);
  };

  const changeCountry = () => {
    playSound('tap');
    clearDrivingCountrySelection();
    setRev((n) => n + 1);
  };

  if (!countryId) {
    return (
      <div className="driving-screen">
        <section className="driving-hero">
          <p className="driving-eyebrow">{t('driveCourseMeta', locale)}</p>
          <h3 className="driving-title">{t('drivePickCountry', locale)}</h3>
          <p className="driving-sub">{t('drivePickCountrySub', locale)}</p>
        </section>

        <ul className="driving-country-list" aria-label={t('drivePickCountry', locale)}>
          {DRIVING_COUNTRIES.map((c) => {
            const name = t(`driveCountry_${c.id}`, locale);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`driving-country-row${c.available ? '' : ' driving-country-row--soon'}`}
                  disabled={!c.available}
                  onClick={() => pickCountry(c.id, c.available)}
                >
                  <span className="driving-country-flag-wrap">
                    <DrivingCountryFlag id={c.id} />
                  </span>
                  <span className="driving-country-main">
                    <span className="driving-country-name">{name}</span>
                    {!c.available && (
                      <span className="driving-country-soon">{t('driveCountrySoon', locale)}</span>
                    )}
                  </span>
                  {c.available && (
                    <span className="driving-country-go" aria-hidden="true">
                      <DrivingChevron />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const answered = progress?.answeredQuestionIds.length ?? 0;
  const correct = progress?.correctCount ?? 0;
  const wrong = progress?.wrongCount ?? 0;
  const learned = progress?.learnedSignIds.length ?? 0;
  const countryName = t(`driveCountry_${countryId}`, locale);

  const previewIds = ['B5', 'B1', 'A7b', 'C1', 'D5', 'A23'] as const;

  return (
    <div className="driving-screen">
      <section className="driving-hero driving-hero--live">
        <div className="driving-hero-copy">
          <p className="driving-eyebrow">{t('driveCourseMeta', locale)}</p>
          <h3 className="driving-title">
            {t('driveHubTitle', locale).replace('{country}', countryName)}
          </h3>
          <p className="driving-sub">{t('driveHubSubLive', locale)}</p>
        </div>
        <div className="driving-hero-signs" aria-hidden="true">
          {previewIds.map((id) => (
            <DrivingSignArt key={id} id={id} className="driving-hero-sign" />
          ))}
        </div>
      </section>

      <section className="driving-stats" aria-label={t('driveStatsLabel', locale)}>
        <div className="driving-stat">
          <span className="driving-stat-value">{answered}</span>
          <span className="driving-stat-label">{t('driveStatAnswered', locale)}</span>
        </div>
        <div className="driving-stat">
          <span className="driving-stat-value">{correct}</span>
          <span className="driving-stat-label">{t('driveStatCorrect', locale)}</span>
        </div>
        <div className="driving-stat">
          <span className="driving-stat-value">{wrong}</span>
          <span className="driving-stat-label">{t('driveStatWrong', locale)}</span>
        </div>
      </section>

      <section className="driving-modes" aria-label={t('driveModesLabel', locale)}>
        <button type="button" className="driving-mode-card" onClick={() => enter('learn')}>
          <span className="driving-mode-thumbs" aria-hidden="true">
            <DrivingSignArt id="B5" className="driving-mode-thumb" />
            <DrivingSignArt id="C1" className="driving-mode-thumb" />
            <DrivingSignArt id="A7b" className="driving-mode-thumb" />
          </span>
          <span className="driving-mode-copy">
            <span className="driving-mode-kicker">{t('driveModeLearnKicker', locale)}</span>
            <span className="driving-mode-title">{t('driveModeLearn', locale)}</span>
            <span className="driving-mode-sub">
              {t('driveModeLearnSub', locale)
                .replace('{n}', String(learned))
                .replace('{total}', String(DRIVING_SIGNS.length))}
            </span>
            <span className="driving-mode-cta">
              {t('driveStart', locale)} <DrivingChevron />
            </span>
          </span>
        </button>

        <button type="button" className="driving-mode-card" onClick={() => enter('exercise')}>
          <span className="driving-mode-thumbs" aria-hidden="true">
            <DrivingSignArt id="E5" className="driving-mode-thumb" />
            <DrivingSignArt id="D7" className="driving-mode-thumb" />
          </span>
          <span className="driving-mode-copy">
            <span className="driving-mode-kicker">{t('driveModeExerciseKicker', locale)}</span>
            <span className="driving-mode-title">{t('driveModeExercise', locale)}</span>
            <span className="driving-mode-sub">
              {t('driveModeExerciseSub', locale).replace('{n}', String(DRIVING_EXERCISE_SIZE))}
            </span>
            <span className="driving-mode-cta">
              {t('driveStart', locale)} <DrivingChevron />
            </span>
          </span>
        </button>

        <button type="button" className="driving-mode-card driving-mode-card--exam" onClick={() => enter('exam')}>
          <span className="driving-mode-thumbs" aria-hidden="true">
            <DrivingSignArt id="B1" className="driving-mode-thumb" />
            <DrivingSignArt id="D5" className="driving-mode-thumb" />
          </span>
          <span className="driving-mode-copy">
            <span className="driving-mode-kicker">{t('driveModeExamKicker', locale)}</span>
            <span className="driving-mode-title">{t('driveModeExam', locale)}</span>
            <span className="driving-mode-sub">
              {t('driveModeExamSub', locale).replace('{n}', String(DRIVING_EXAM_SIZE))}
            </span>
            <span className="driving-mode-cta">
              {t('driveStart', locale)} <DrivingChevron />
            </span>
          </span>
        </button>
      </section>

      <button type="button" className="btn-secondary driving-change-country" onClick={changeCountry}>
        {t('driveChangeCountry', locale)}
      </button>
    </div>
  );
}
