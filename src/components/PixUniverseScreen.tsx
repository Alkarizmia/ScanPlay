import { useEffect, useState } from 'react';
import { BackIcon } from './icons/BackIcon';
import { UniverseHeartsBar } from './UniverseHeartsBar';
import { EnglishOnboarding } from './EnglishOnboarding';
import { EnglishCourseHub } from './EnglishCourseHub';
import { EnglishChapterSkip } from './EnglishChapterSkip';
import { EnglishLessonPlay } from './EnglishLessonPlay';
import { DrivingLicenseScreen } from './DrivingLicenseScreen';
import { isLoggedIn } from '../lib/auth';
import { canPlayUniverse, getUniverseHearts } from '../lib/universeHearts';
import { isUniverseEnglishOnboarded, getUniverseEnglish } from '../lib/universeEnglish';
import { getUniverseDriving } from '../lib/universeDriving';
import { listChaptersForGoal } from '../lib/englishCurriculum';
import { syncUniverseEnglishFromCloud } from '../lib/universeProgressSync';
import { playSound } from '../lib/sounds';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

type UniverseView =
  | 'store'
  | 'englishOnboard'
  | 'englishHub'
  | 'englishPlay'
  | 'englishSkip'
  | 'driving';

interface PixUniverseScreenProps {
  locale: Locale;
  onBack: () => void;
}

/** Store for Pix courses — English + driving license catalog. */
export function PixUniverseScreen({ locale, onBack }: PixUniverseScreenProps) {
  const [view, setView] = useState<UniverseView>('store');
  const [heartsTick, setHeartsTick] = useState(0);
  const [breakKey, setBreakKey] = useState(0);
  const [playLessonId, setPlayLessonId] = useState<string | null>(null);
  const [skipChapterId, setSkipChapterId] = useState<string | null>(null);
  const [drivingPlay, setDrivingPlay] = useState(false);
  const [syncTick, setSyncTick] = useState(0);
  const hearts = getUniverseHearts().hearts;
  const locked = !canPlayUniverse();
  const guest = !isLoggedIn();
  const driving = getUniverseDriving();
  const drivingStarted = driving.countryId != null;

  useEffect(() => {
    let cancelled = false;
    void syncUniverseEnglishFromCloud().then(() => {
      if (!cancelled) setSyncTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openEnglish = () => {
    playSound('tap');
    if (locked) return;
    void syncUniverseEnglishFromCloud().then(() => setSyncTick((n) => n + 1));
    setView(isUniverseEnglishOnboarded() ? 'englishHub' : 'englishOnboard');
  };

  const openDriving = () => {
    playSound('tap');
    if (locked) return;
    setView('driving');
  };

  if (view === 'englishOnboard') {
    return (
      <div className="screen flow-screen pix-universe-screen">
        <header className="top-bar">
          <button type="button" className="icon-btn" onClick={() => setView('store')} aria-label={t('back', locale)}>
            <BackIcon />
          </button>
          <h2 className="screen-title">{t('engCourseTitle', locale)}</h2>
          <span className="top-spacer" />
        </header>
        <main className="pix-universe-main scroll-natural">
          <EnglishOnboarding locale={locale} onDone={() => setView('englishHub')} />
        </main>
      </div>
    );
  }

  if (view === 'englishHub') {
    return (
      <div className="screen flow-screen pix-universe-screen">
        <header className="top-bar">
          <button type="button" className="icon-btn" onClick={() => setView('store')} aria-label={t('back', locale)}>
            <BackIcon />
          </button>
          <h2 className="screen-title">{t('engCourseTitle', locale)}</h2>
          <span className="top-spacer" />
        </header>
        <main className="pix-universe-main scroll-natural">
          <UniverseHeartsBar locale={locale} refreshKey={heartsTick} breakKey={breakKey} />
          <EnglishCourseHub
            locale={locale}
            refreshKey={heartsTick + syncTick}
            onHeartLost={() => {
              setBreakKey((k) => k + 1);
              setHeartsTick((k) => k + 1);
            }}
            onPlay={(lessonId) => {
              setPlayLessonId(lessonId);
              setView('englishPlay');
            }}
            onSkipChapter={(chapterId) => {
              setSkipChapterId(chapterId);
              setView('englishSkip');
            }}
          />
        </main>
      </div>
    );
  }

  if (view === 'englishSkip' && skipChapterId) {
    const profile = getUniverseEnglish();
    const chapters = listChaptersForGoal(profile.goal);
    const ch = chapters.find((c) => c.id === skipChapterId);
    const titleLang = locale === 'en' ? 'en' : locale === 'nl' || locale === 'es' || locale === 'ar' ? locale : 'fr';
    return (
      <div className="screen flow-screen pix-universe-screen pix-universe-screen--play">
        <EnglishChapterSkip
          locale={locale}
          chapterId={skipChapterId}
          chapterTitle={ch?.title[titleLang] ?? ''}
          onClose={() => {
            setSkipChapterId(null);
            setView('englishHub');
            setHeartsTick((k) => k + 1);
          }}
          onHeartLost={() => {
            setBreakKey((k) => k + 1);
            setHeartsTick((k) => k + 1);
          }}
          onPassed={() => {
            setSkipChapterId(null);
            setView('englishHub');
            setHeartsTick((k) => k + 1);
          }}
        />
      </div>
    );
  }

  if (view === 'englishPlay' && playLessonId) {
    return (
      <div className="screen flow-screen pix-universe-screen pix-universe-screen--play">
        <EnglishLessonPlay
          locale={locale}
          lessonId={playLessonId}
          onHeartLost={() => {
            setBreakKey((k) => k + 1);
            setHeartsTick((k) => k + 1);
          }}
          onExit={() => {
            setView('englishHub');
            setHeartsTick((k) => k + 1);
          }}
          onComplete={() => {
            setView('englishHub');
            setHeartsTick((k) => k + 1);
          }}
        />
      </div>
    );
  }

  if (view === 'driving') {
    return (
      <div
        className={`screen flow-screen pix-universe-screen${drivingPlay ? ' pix-universe-screen--play' : ''}`}
      >
        {!drivingPlay && (
          <header className="top-bar">
            <button type="button" className="icon-btn" onClick={() => setView('store')} aria-label={t('back', locale)}>
              <BackIcon />
            </button>
            <h2 className="screen-title">{t('driveCourseTitle', locale)}</h2>
            <span className="top-spacer" />
          </header>
        )}
        <main className={`pix-universe-main${drivingPlay ? '' : ' scroll-natural'}`}>
          {!drivingPlay && (
            <UniverseHeartsBar locale={locale} refreshKey={heartsTick} breakKey={breakKey} />
          )}
          <DrivingLicenseScreen
            locale={locale}
            refreshKey={heartsTick}
            onHeartLost={() => {
              setBreakKey((k) => k + 1);
              setHeartsTick((k) => k + 1);
            }}
            onPlayModeChange={(playing) => {
              setDrivingPlay(playing);
              if (!playing) setHeartsTick((k) => k + 1);
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="screen flow-screen pix-universe-screen">
      <div className="import-ambient" aria-hidden="true">
        <span className="import-ambient-orb import-ambient-orb--a" />
        <span className="import-ambient-orb import-ambient-orb--b" />
        <span className="import-ambient-orb import-ambient-orb--c" />
        <span className="import-ambient-sheen" />
      </div>

      <header className="top-bar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back', locale)}>
          <BackIcon />
        </button>
        <h2 className="screen-title">{t('pixUniverseTitle', locale)}</h2>
        <span className="top-spacer" />
      </header>

      <main className="pix-universe-main scroll-natural">
        <section className="pix-universe-hero">
          <p className="pix-universe-kicker">{t('pixUniverseKicker', locale)}</p>
          <h3 className="pix-universe-headline">{t('pixUniverseHeadline', locale)}</h3>
          <p className="pix-universe-sub">{t('pixUniverseSub', locale)}</p>
          <UniverseHeartsBar locale={locale} refreshKey={heartsTick} breakKey={breakKey} />
          {guest && (
            <p className="pix-universe-guest-hint" role="note">
              {t('engSyncGuestHint', locale)}
            </p>
          )}
          {locked && (
            <p className="pix-universe-locked-banner" role="status">
              {t('universeHeartsComeBack', locale)}
            </p>
          )}
        </section>

        <section className="pix-universe-store" aria-label={t('pixUniverseTitle', locale)}>
          <button
            type="button"
            className={`pix-universe-card${locked ? ' pix-universe-card--locked' : ''}`}
            disabled={locked}
            onClick={openEnglish}
          >
            <span className="pix-universe-card-media" aria-hidden="true">
              <img
                src="/universe/english-cover.jpg"
                alt=""
                className="pix-universe-card-cover"
                width={1280}
                height={720}
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            </span>
            <span className="pix-universe-card-body">
              <span className="pix-universe-card-meta">{t('engCourseLevels', locale)}</span>
              <span className="pix-universe-card-title">{t('engCourseTitle', locale)}</span>
              <span className="pix-universe-card-sub">{t('engCourseCardSub', locale)}</span>
              <span className="pix-universe-card-private">{t('engCoursePrivate', locale)}</span>
              <span className="pix-universe-card-cta">
                {isUniverseEnglishOnboarded() ? t('engOpenContinue', locale) : t('engOpenStart', locale)}
              </span>
            </span>
          </button>

          <button
            type="button"
            className={`pix-universe-card${locked ? ' pix-universe-card--locked' : ''}`}
            disabled={locked}
            onClick={openDriving}
          >
            <span className="pix-universe-card-media" aria-hidden="true">
              <img
                src="/universe/driving-cover.jpg"
                alt=""
                className="pix-universe-card-cover"
                width={1280}
                height={720}
                loading="eager"
                decoding="async"
              />
            </span>
            <span className="pix-universe-card-body">
              <span className="pix-universe-card-meta">{t('driveCourseMeta', locale)}</span>
              <span className="pix-universe-card-title">{t('driveCourseTitle', locale)}</span>
              <span className="pix-universe-card-sub">{t('driveCourseCardSub', locale)}</span>
              <span className="pix-universe-card-private">{t('driveCoursePrivate', locale)}</span>
              <span className="pix-universe-card-cta">
                {drivingStarted ? t('driveOpenContinue', locale) : t('driveOpenStart', locale)}
              </span>
            </span>
          </button>

          <p className="pix-universe-hearts-legend">
            {t('universeHeartsLegend', locale).replace('{n}', String(hearts))}
          </p>
        </section>
      </main>
    </div>
  );
}
