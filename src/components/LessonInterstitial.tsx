import { useEffect } from 'react';
import { playSound } from '../lib/sounds';
import { vibrateSuccess } from '../lib/haptics';
import { t } from '../lib/i18n';
import { ScanPlayMascot } from './mascot/ScanPlayMascot';
import type { Locale, SessionResult } from '../types';

interface LessonInterstitialProps {
  locale: Locale;
  result: SessionResult;
  gameIndex: number;
  gamesTotal: number;
  onContinue: () => void;
}

function getFeedbackKey(pct: number): 'lessonStepGreat' | 'lessonStepGood' | 'lessonStepOk' {
  if (pct >= 90) return 'lessonStepGreat';
  if (pct >= 60) return 'lessonStepGood';
  return 'lessonStepOk';
}

export function LessonInterstitial({
  locale,
  result,
  gameIndex,
  gamesTotal,
  onContinue,
}: LessonInterstitialProps) {
  const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;

  useEffect(() => {
    if (pct >= 90) playSound('coinPop');
    else if (pct >= 60) playSound('miniWin');
    else playSound('progressBlip');
  }, [pct]);

  const handleContinue = () => {
    playSound('whoosh');
    vibrateSuccess();
    onContinue();
  };

  return (
    <div className="screen lesson-interstitial">
      <div className="lesson-interstitial-progress" aria-hidden="true">
        {Array.from({ length: gamesTotal }, (_, i) => (
          <span
            key={i}
            className={`lesson-dot${i < gameIndex ? ' lesson-dot--done' : ''}${i === gameIndex - 1 ? ' lesson-dot--current' : ''}`}
          />
        ))}
      </div>

      <div className="lesson-interstitial-body">
        <ScanPlayMascot
          expression={pct >= 70 ? 'excited' : pct >= 40 ? 'happy' : 'encouraging'}
          size={88}
          idle
        />
        <p className="lesson-interstitial-title">{t(getFeedbackKey(pct), locale)}</p>
        <p className="lesson-interstitial-score">
          {result.score}/{result.total} · {pct}%
        </p>
      </div>

      <footer className="lesson-interstitial-footer">
        <button type="button" className="btn-primary btn-lg lesson-continue-btn" onClick={handleContinue}>
          {t('lessonContinue', locale)}
        </button>
      </footer>
    </div>
  );
}
