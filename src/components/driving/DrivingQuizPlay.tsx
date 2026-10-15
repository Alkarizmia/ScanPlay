import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DRIVING_EXAM_ANSWER_SECONDS,
  DRIVING_EXAM_PASS_SCORE,
  DRIVING_EXAM_SIZE,
  DRIVING_EXERCISE_SIZE,
  pickDrivingQuestions,
  scoreDrivingExam,
  type DrivingQuestion,
} from '../../lib/drivingBelgium';
import {
  bumpDrivingSession,
  recordDrivingAnswer,
  recordDrivingExamPassed,
} from '../../lib/universeDriving';
import { loseUniverseHeart, canPlayUniverse } from '../../lib/universeHearts';
import { DrivingSignArt } from './DrivingSignArt';
import { DrivingSceneArt } from './DrivingSceneArt';
import { playSound } from '../../lib/sounds';
import { t } from '../../lib/i18n';
import type { Locale } from '../../types';
import { UniverseOutOfHearts } from '../UniverseOutOfHearts';
import { ScanPlayMascot } from '../mascot/ScanPlayMascot';
import { Confetti } from '../Confetti';
import type { MascotExpression } from '../../lib/mascot/types';

export type DrivingQuizMode = 'exercise' | 'exam';

interface DrivingQuizPlayProps {
  locale: Locale;
  mode: DrivingQuizMode;
  onExit: () => void;
  onHeartLost: () => void;
  onFinished: () => void;
}

type Phase = 'play' | 'pass' | 'fail' | 'locked';

/** Brief pause so the énoncé can be read before the 15s answer clock starts. */
const EXAM_ENONCE_MS = 2200;

/**
 * Theory MCQ: exercise keeps feedback + hearts.
 * Exam blanc: 50 QCM, 15s after énoncé, no hearts, result only at the end.
 */
export function DrivingQuizPlay({
  locale,
  mode,
  onExit,
  onHeartLost,
  onFinished,
}: DrivingQuizPlayProps) {
  const isExam = mode === 'exam';
  const size = isExam ? DRIVING_EXAM_SIZE : DRIVING_EXERCISE_SIZE;
  const deck = useMemo(
    () => pickDrivingQuestions(size, `${mode}-${Date.now() % 10000}`),
    [mode, size],
  );

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [graveWrong, setGraveWrong] = useState(0);
  const [examScore, setExamScore] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [timerArmed, setTimerArmed] = useState(false);
  const [phase, setPhase] = useState<Phase>(() =>
    isExam || canPlayUniverse() ? 'play' : 'locked',
  );

  const startedRef = useRef(false);
  const submittedRef = useRef(false);
  const pickedRef = useRef<number | null>(null);
  const indexRef = useRef(0);
  const correctRef = useRef(0);
  const wrongRef = useRef(0);
  const graveWrongRef = useRef(0);
  const deckRef = useRef(deck);
  deckRef.current = deck;
  indexRef.current = index;
  pickedRef.current = picked;

  useEffect(() => {
    if (startedRef.current || phase !== 'play') return;
    startedRef.current = true;
    bumpDrivingSession('be');
  }, [phase]);

  const q: DrivingQuestion | undefined = deck[index];

  const finishExam = (nextCorrect: number, nextGrave: number) => {
    const result = scoreDrivingExam({
      total: deckRef.current.length,
      correct: nextCorrect,
      graveWrong: nextGrave,
    });
    setExamScore(result.score);
    playSound(result.passed ? 'perfect' : 'wrong');
    if (result.passed) recordDrivingExamPassed('be');
    setPhase(result.passed ? 'pass' : 'fail');
  };

  const advanceExam = (choice: number | null) => {
    const deckNow = deckRef.current;
    const i = indexRef.current;
    const question = deckNow[i];
    if (!question || submittedRef.current) return;
    submittedRef.current = true;

    const ok = choice != null && choice === question.correct;
    recordDrivingAnswer('be', question.id, ok);

    let nextCorrect = correctRef.current;
    let nextWrong = wrongRef.current;
    let nextGrave = graveWrongRef.current;
    if (ok) {
      nextCorrect += 1;
      correctRef.current = nextCorrect;
      setCorrect(nextCorrect);
    } else {
      nextWrong += 1;
      wrongRef.current = nextWrong;
      setWrong(nextWrong);
      if (question.grave) {
        nextGrave += 1;
        graveWrongRef.current = nextGrave;
        setGraveWrong(nextGrave);
      }
    }

    if (i + 1 >= deckNow.length) {
      finishExam(nextCorrect, nextGrave);
      return;
    }

    playSound('tap');
    setIndex(i + 1);
    setPicked(null);
    pickedRef.current = null;
    setSecondsLeft(null);
    setTimerArmed(false);
    submittedRef.current = false;
  };

  // Exam: arm 15s clock after énoncé delay
  useEffect(() => {
    if (!isExam || phase !== 'play' || !q) return;
    setTimerArmed(false);
    setSecondsLeft(null);
    submittedRef.current = false;
    const arm = window.setTimeout(() => {
      setTimerArmed(true);
      setSecondsLeft(DRIVING_EXAM_ANSWER_SECONDS);
    }, EXAM_ENONCE_MS);
    return () => window.clearTimeout(arm);
  }, [isExam, phase, index, q?.id]);

  // Exam countdown tick / timeout
  useEffect(() => {
    if (!isExam || !timerArmed || secondsLeft == null || phase !== 'play') return;
    if (secondsLeft <= 0) {
      advanceExam(pickedRef.current);
      return;
    }
    const id = window.setTimeout(() => {
      setSecondsLeft((s) => (s == null ? s : s - 1));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [isExam, timerArmed, secondsLeft, phase]);

  const validateExercise = () => {
    if (picked == null || !q || revealed) return;
    const ok = picked === q.correct;
    setRevealed(true);
    recordDrivingAnswer('be', q.id, ok);
    if (ok) {
      playSound('correct');
      setCorrect((c) => c + 1);
    } else {
      playSound('wrong');
      setWrong((w) => w + 1);
      const { lost } = loseUniverseHeart();
      if (lost) onHeartLost();
    }
  };

  const continueExercise = () => {
    if (!q) return;
    if (index + 1 >= deck.length) {
      playSound('perfect');
      setPhase('pass');
      return;
    }
    playSound('tap');
    setIndex((i) => i + 1);
    setPicked(null);
    setRevealed(false);
  };

  if (phase === 'locked') {
    return <UniverseOutOfHearts locale={locale} onBack={onExit} />;
  }

  if (phase === 'pass' || phase === 'fail') {
    const passed = phase === 'pass';
    const scoreShown = isExam && examScore != null ? examScore : correct;
    const totalShown = isExam ? deck.length : deck.length;
    const scorePct = Math.max(0, Math.min(100, Math.round((scoreShown / Math.max(1, totalShown)) * 100)));
    const band =
      passed && scoreShown >= 46
        ? 'great'
        : passed
          ? 'pass'
          : scoreShown >= 30
            ? 'close'
            : 'fail';
    const mascotExpr: MascotExpression = passed
      ? scoreShown >= 46
        ? 'celebrating'
        : 'proud'
      : scoreShown >= 30
        ? 'encouraging'
        : 'surprised';

    return (
      <div
        className={`driving-play driving-play--end driving-end driving-end--${band}`}
        role="status"
      >
        <div className="driving-end-bg" aria-hidden="true">
          <span className="driving-end-orb driving-end-orb--a" />
          <span className="driving-end-orb driving-end-orb--b" />
          <span className="driving-end-burst" />
        </div>
        {passed && <Confetti active contained />}

        <div className="driving-end-panel">
          <div className="driving-end-mascot" aria-hidden="true">
            <ScanPlayMascot
              expression={mascotExpr}
              size={120}
              idle
              celebrate={passed}
              preferAsset
            />
          </div>

          <p className="driving-end-kicker">
            {isExam ? t('driveModeExam', locale) : t('driveModeExercise', locale)}
          </p>
          <h2 className="driving-end-title">
            {passed ? t('driveResultPass', locale) : t('driveResultFail', locale)}
          </h2>
          <p className="driving-end-flavor">
            {passed
              ? t(scoreShown >= 46 ? 'driveResultFlavorGreat' : 'driveResultFlavorPass', locale)
              : t(scoreShown >= 30 ? 'driveResultFlavorClose' : 'driveResultFlavorFail', locale)}
          </p>

          <div className="driving-end-score-ring" style={{ ['--score-pct' as string]: `${scorePct}%` }}>
            <div className="driving-end-score-inner">
              <p className="driving-end-score-text">
                <span className="driving-end-score-num">{scoreShown}</span>
                <span className="driving-end-score-den">/{totalShown}</span>
              </p>
            </div>
          </div>

          {isExam && (
            <p className="driving-end-threshold">
              {t('driveResultExamScore', locale)
                .replace('{score}', String(scoreShown))
                .replace('{pass}', String(DRIVING_EXAM_PASS_SCORE))
                .replace('{total}', String(deck.length))}
            </p>
          )}

          <div className="driving-end-stats">
            <div className="driving-end-stat driving-end-stat--ok">
              <span className="driving-end-stat-val">{correct}</span>
              <span className="driving-end-stat-label">{t('driveStatCorrect', locale)}</span>
            </div>
            <div className="driving-end-stat driving-end-stat--bad">
              <span className="driving-end-stat-val">{wrong}</span>
              <span className="driving-end-stat-label">{t('driveStatWrong', locale)}</span>
            </div>
            {isExam && (
              <div className={`driving-end-stat${graveWrong > 0 ? ' driving-end-stat--grave' : ''}`}>
                <span className="driving-end-stat-val">{graveWrong}</span>
                <span className="driving-end-stat-label">{t('driveStatGrave', locale)}</span>
              </div>
            )}
          </div>

          {isExam && graveWrong > 0 && (
            <p className="driving-end-grave-note">
              {t('driveResultExamGrave', locale).replace('{n}', String(graveWrong))}
            </p>
          )}

          <button
            type="button"
            className="driving-validate-btn driving-end-cta"
            onClick={() => {
              playSound('tap');
              onFinished();
              onExit();
            }}
          >
            {t('driveBackHub', locale)}
          </button>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="driving-play driving-play--end">
        <p>{t('driveNoQuestions', locale)}</p>
        <button type="button" className="btn-secondary" onClick={onExit}>
          {t('back', locale)}
        </button>
      </div>
    );
  }

  const letters = ['A', 'B', 'C'] as const;
  const showVisual = Boolean(q.sceneId || q.signId);
  const timerUrgent = isExam && secondsLeft != null && secondsLeft <= 5;

  return (
    <div className={`driving-play${isExam ? ' driving-play--exam' : ''}`}>
      <header className="driving-play-bar">
        <button type="button" className="driving-play-x" onClick={onExit} aria-label={t('back', locale)}>
          ✕
        </button>
        <div className="driving-play-progress-wrap">
          <p className="driving-play-progress">
            {t('driveQuestionProgress', locale)
              .replace('{n}', String(index + 1))
              .replace('{total}', String(deck.length))}
          </p>
          <div className="driving-xp-track" aria-hidden="true">
            <span
              className="driving-xp-fill"
              style={{ width: `${Math.round(((index + 1) / deck.length) * 100)}%` }}
            />
          </div>
        </div>
        {isExam ? (
          <span
            className={`driving-exam-timer${timerUrgent ? ' is-urgent' : ''}${!timerArmed ? ' is-waiting' : ''}`}
            aria-live="polite"
          >
            {timerArmed && secondsLeft != null
              ? t('driveExamTimer', locale).replace('{s}', String(secondsLeft))
              : t('driveExamReading', locale)}
          </span>
        ) : (
          <span className="driving-play-mode">{t('driveModeExercise', locale)}</span>
        )}
      </header>

      <div className="driving-quiz-layout">
        {showVisual && (
          <div className="driving-quiz-visual">
            <div
              className={`driving-quiz-visual-card${q.sceneId ? ' driving-quiz-visual-card--scene' : ''}`}
            >
              {q.sceneId ? (
                <DrivingSceneArt id={q.sceneId} />
              ) : q.signId ? (
                <DrivingSignArt id={q.signId} />
              ) : null}
            </div>
          </div>
        )}

        <div className="driving-quiz-main">
          <h2 className="driving-quiz-prompt">{q.prompt}</h2>
          <div className="driving-quiz-choices" role="listbox" aria-label={q.prompt}>
            {q.choices.map((choice, i) => {
              let state = '';
              if (!isExam && revealed) {
                if (i === q.correct) state = ' is-correct';
                else if (i === picked) state = ' is-wrong';
                else state = ' is-muted';
              } else if (picked === i) state = ' is-picked';
              return (
                <button
                  key={i}
                  type="button"
                  role="option"
                  aria-selected={picked === i}
                  className={`driving-quiz-choice${state}`}
                  disabled={!isExam && revealed}
                  onClick={() => {
                    playSound('tap');
                    setPicked(i);
                    pickedRef.current = i;
                  }}
                >
                  <span className="driving-quiz-letter">{letters[i]}.</span>
                  <span className="driving-quiz-choice-text">{choice}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <footer className="driving-play-footer driving-play-footer--single">
        {isExam ? (
          <button
            type="button"
            className="driving-validate-btn"
            disabled={picked == null || !timerArmed}
            onClick={() => advanceExam(picked)}
          >
            {t('driveExamNext', locale)}
          </button>
        ) : !revealed ? (
          <button
            type="button"
            className="driving-validate-btn"
            disabled={picked == null}
            onClick={validateExercise}
          >
            {t('driveValidate', locale)}
          </button>
        ) : (
          <button type="button" className="driving-validate-btn" onClick={continueExercise}>
            {t('driveContinue', locale)}
          </button>
        )}
      </footer>
    </div>
  );
}
