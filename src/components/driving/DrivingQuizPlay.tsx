import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DRIVING_EXAM_MAX_WRONG,
  DRIVING_EXAM_SIZE,
  DRIVING_EXERCISE_SIZE,
  pickDrivingQuestions,
  type DrivingQuestion,
} from '../../lib/drivingBelgium';
import {
  bumpDrivingSession,
  recordDrivingAnswer,
  recordDrivingExamPassed,
} from '../../lib/universeDriving';
import { loseUniverseHeart, canPlayUniverse } from '../../lib/universeHearts';
import { DrivingSignArt } from './DrivingSignArt';
import { playSound } from '../../lib/sounds';
import { t } from '../../lib/i18n';
import type { Locale } from '../../types';

export type DrivingQuizMode = 'exercise' | 'exam';

interface DrivingQuizPlayProps {
  locale: Locale;
  mode: DrivingQuizMode;
  onExit: () => void;
  onHeartLost: () => void;
  onFinished: () => void;
}

type Phase = 'play' | 'pass' | 'fail' | 'locked';

/**
 * Theory MCQ UI inspired by Belgian exam apps: visual + A/B/C + Valider.
 * Hearts lost on wrong answers (exercise & exam only).
 */
export function DrivingQuizPlay({
  locale,
  mode,
  onExit,
  onHeartLost,
  onFinished,
}: DrivingQuizPlayProps) {
  const size = mode === 'exam' ? DRIVING_EXAM_SIZE : DRIVING_EXERCISE_SIZE;
  const maxWrong = mode === 'exam' ? DRIVING_EXAM_MAX_WRONG : 99;
  const deck = useMemo(
    () => pickDrivingQuestions(size, `${mode}-${Date.now() % 10000}`),
    [mode, size],
  );

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [phase, setPhase] = useState<Phase>(() => (canPlayUniverse() ? 'play' : 'locked'));
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || phase !== 'play') return;
    startedRef.current = true;
    bumpDrivingSession('be');
  }, [phase]);

  const q: DrivingQuestion | undefined = deck[index];

  const finish = (ok: boolean) => {
    playSound(ok ? 'perfect' : 'wrong');
    if (ok && mode === 'exam') recordDrivingExamPassed('be');
    setPhase(ok ? 'pass' : 'fail');
  };

  const validate = () => {
    if (picked == null || !q || revealed) return;
    const ok = picked === q.correct;
    setRevealed(true);
    recordDrivingAnswer('be', q.id, ok);
    if (ok) {
      playSound('correct');
      setCorrect((c) => c + 1);
    } else {
      playSound('wrong');
      const nextWrong = wrong + 1;
      setWrong(nextWrong);
      const { lost } = loseUniverseHeart();
      if (lost) onHeartLost();
      if (nextWrong > maxWrong) {
        window.setTimeout(() => finish(false), 700);
        return;
      }
    }
  };

  const continueNext = () => {
    if (!q) return;
    if (index + 1 >= deck.length) {
      finish(wrong <= maxWrong);
      return;
    }
    playSound('tap');
    setIndex((i) => i + 1);
    setPicked(null);
    setRevealed(false);
  };

  if (phase === 'locked') {
    return (
      <div className="driving-play driving-play--end">
        <p className="driving-end-title">{t('universeHeartsComeBack', locale)}</p>
        <button type="button" className="btn-primary" onClick={onExit}>
          {t('back', locale)}
        </button>
      </div>
    );
  }

  if (phase === 'pass' || phase === 'fail') {
    return (
      <div className="driving-play driving-play--end">
        <p className="driving-end-title">
          {phase === 'pass' ? t('driveResultPass', locale) : t('driveResultFail', locale)}
        </p>
        <p className="driving-end-sub">
          {t('driveResultStats', locale)
            .replace('{ok}', String(correct))
            .replace('{bad}', String(wrong))
            .replace('{total}', String(deck.length))}
        </p>
        <button
          type="button"
          className="driving-validate-btn"
          onClick={() => {
            onFinished();
            onExit();
          }}
        >
          {t('driveBackHub', locale)}
        </button>
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

  return (
    <div className="driving-play">
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
        <span className="driving-play-mode">
          {mode === 'exam' ? t('driveModeExam', locale) : t('driveModeExercise', locale)}
        </span>
      </header>

      <div className="driving-quiz-layout">
        {q.signId && (
          <div className="driving-quiz-visual">
            <div className="driving-quiz-visual-card">
              <DrivingSignArt id={q.signId} />
            </div>
          </div>
        )}

        <div className="driving-quiz-main">
          <h2 className="driving-quiz-prompt">{q.prompt}</h2>
          <div className="driving-quiz-choices" role="listbox" aria-label={q.prompt}>
            {q.choices.map((choice, i) => {
              let state = '';
              if (revealed) {
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
                  disabled={revealed}
                  onClick={() => {
                    playSound('tap');
                    setPicked(i);
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
        {!revealed ? (
          <button
            type="button"
            className="driving-validate-btn"
            disabled={picked == null}
            onClick={validate}
          >
            {t('driveValidate', locale)}
          </button>
        ) : (
          <button type="button" className="driving-validate-btn" onClick={continueNext}>
            {t('driveContinue', locale)}
          </button>
        )}
      </footer>
    </div>
  );
}
