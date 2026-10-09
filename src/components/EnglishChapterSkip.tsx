import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import {
  CHAPTER_SKIP_MAX_WRONG,
  getChapterExamPairs,
  getUniverseEnglish,
  skipEnglishChapter,
} from '../lib/universeEnglish';
import { canPlayUniverse, loseUniverseHeart } from '../lib/universeHearts';
import { playSound } from '../lib/sounds';
import { t } from '../lib/i18n';
import type { Locale, WordPair } from '../types';

const QuizGame = lazy(() => import('./games/QuizGame').then((m) => ({ default: m.QuizGame })));
const TypeGame = lazy(() => import('./games/TypeGame').then((m) => ({ default: m.TypeGame })));

interface EnglishChapterSkipProps {
  locale: Locale;
  chapterId: string;
  chapterTitle: string;
  onClose: () => void;
  onPassed: () => void;
  onHeartLost: () => void;
}

/**
 * Hard mini-exam to skip a chapter. Fail if 2+ wrongs (max 1 miss allowed).
 */
export function EnglishChapterSkip({
  locale,
  chapterId,
  chapterTitle,
  onClose,
  onPassed,
  onHeartLost,
}: EnglishChapterSkipProps) {
  const profile = getUniverseEnglish();
  const pairs = useMemo(
    () => getChapterExamPairs(chapterId, profile.nativeLang, profile.level),
    [chapterId, profile.nativeLang, profile.level],
  );
  /** B1+ always types a hard sample after the quiz — MCQ alone is too soft. */
  const hardenType = ['B1', 'B2', 'C1', 'C2'].includes(profile.level);
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'type' | 'fail' | 'pass'>('intro');
  const [typePairs, setTypePairs] = useState<WordPair[]>([]);
  const wrongs = useRef(0);
  const weak = useRef<WordPair[]>([]);

  const failCheck = () => {
    if (wrongs.current > CHAPTER_SKIP_MAX_WRONG) {
      playSound('wrong');
      setPhase('fail');
      return true;
    }
    return false;
  };

  const onWrong = (pair: WordPair) => {
    wrongs.current += 1;
    weak.current = [...weak.current.filter((p) => p.term !== pair.term), pair];
    const { lost } = loseUniverseHeart();
    if (lost) onHeartLost();
    failCheck();
  };

  if (!canPlayUniverse() && phase !== 'fail' && phase !== 'pass' && phase !== 'intro') {
    return (
      <div className="english-skip">
        <p className="pix-universe-locked-banner">{t('universeHeartsComeBack', locale)}</p>
        <button type="button" className="btn-secondary" onClick={onClose}>
          {t('back', locale)}
        </button>
      </div>
    );
  }

  if (pairs.length < 4) {
    return (
      <div className="english-skip">
        <p>{t('engSkipNotReady', locale)}</p>
        <button type="button" className="btn-secondary" onClick={onClose}>
          {t('back', locale)}
        </button>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="english-skip english-skip--card">
        <h3 className="english-onboard-title">{t('engSkipTitle', locale)}</h3>
        <p className="english-onboard-sub">
          {t('engSkipSub', locale).replace('{chapter}', chapterTitle)}
        </p>
        <p className="english-skip-rule">{t('engSkipRule', locale)}</p>
        <button
          type="button"
          className="btn-primary english-onboard-cta"
          onClick={() => {
            playSound('tap');
            wrongs.current = 0;
            weak.current = [];
            setPhase('quiz');
          }}
        >
          {t('engSkipStart', locale)}
        </button>
        <button type="button" className="btn-secondary english-onboard-cta" onClick={onClose}>
          {t('cancel', locale)}
        </button>
      </div>
    );
  }

  if (phase === 'fail') {
    return (
      <div className="english-skip english-skip--card">
        <h3 className="english-onboard-title">{t('engSkipFail', locale)}</h3>
        <p className="english-onboard-sub">{t('engSkipFailSub', locale)}</p>
        <button type="button" className="btn-primary english-onboard-cta" onClick={onClose}>
          {t('engNext', locale)}
        </button>
      </div>
    );
  }

  if (phase === 'pass') {
    return (
      <div className="english-skip english-skip--card">
        <p className="english-play-xp">+40 XP</p>
        <h3 className="english-onboard-title">{t('engSkipPass', locale)}</h3>
        <p className="english-onboard-sub">{t('engSkipPassSub', locale)}</p>
        <button
          type="button"
          className="btn-primary english-onboard-cta"
          onClick={() => {
            skipEnglishChapter(chapterId);
            playSound('levelUp');
            onPassed();
          }}
        >
          {t('engNext', locale)}
        </button>
      </div>
    );
  }

  return (
    <div className="english-skip english-skip--exam">
      <Suspense fallback={<div className="screen-loading" aria-busy="true" />}>
        {phase === 'quiz' && (
          <QuizGame
            pairs={pairs}
            locale={locale}
            maxItems={Math.min(hardenType ? 10 : 12, pairs.length)}
            examMode
            shuffleSeed={`skip-${chapterId}-${profile.level}`}
            onAnswer={(pair, correct) => {
              if (!correct) {
                onWrong(pair);
                if (wrongs.current > CHAPTER_SKIP_MAX_WRONG) return;
              }
            }}
            onComplete={() => {
              if (failCheck()) return;
              const typed = new Map<string, WordPair>();
              for (const p of weak.current) typed.set(p.term.toLowerCase(), p);
              if (hardenType) {
                for (const p of pairs.slice(0, 6)) typed.set(p.term.toLowerCase(), p);
              }
              const nextType = [...typed.values()];
              if (nextType.length > 0) {
                setTypePairs(nextType);
                setPhase('type');
                return;
              }
              setPhase('pass');
            }}
            onExit={onClose}
          />
        )}
        {phase === 'type' && typePairs.length > 0 && (
          <TypeGame
            pairs={typePairs}
            locale={locale}
            maxItems={typePairs.length}
            examMode
            onAnswer={(pair, correct) => {
              if (!correct) {
                onWrong(pair);
              }
            }}
            onComplete={() => {
              if (failCheck()) return;
              setPhase('pass');
            }}
            onExit={onClose}
          />
        )}
      </Suspense>
    </div>
  );
}
