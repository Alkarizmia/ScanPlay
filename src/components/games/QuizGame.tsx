import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getExamTimerSeconds } from '../../lib/examTimer';
import { playGameCorrectSound, playSound } from '../../lib/sounds';

import { addCorrectAnswer } from '../../lib/gamification';

import { vibrateError, vibrateSuccess } from '../../lib/haptics';

import { t } from '../../lib/i18n';

import { markCorrected, recordMistake } from '../../lib/mistakes';
import { HearButton } from '../HearButton';

import { markDifficult } from '../../lib/spacedRepetition';

import {

  getQuizPool,

  hasEnoughQuizPairsRelaxed,

  MIN_QUIZ_PAIRS_RELAXED,

  pickQuizOptions,

} from '../../lib/vocabulary';

import { resolveSpeakLang } from '../../lib/speakLang';
import { seededShuffle } from '../../lib/seededRandom';
import type { Locale, WordPair } from '../../types';
import { gameProgressPct, GameHeader } from './GameHeader';

interface QuizGameProps {

  pairs: WordPair[];

  locale: Locale;

  examMode?: boolean;

  deckId?: string | null;

  stepIndex?: number | null;

  onComplete: (score: number, total: number) => void;

  onExit: () => void;

  onNotEnoughPairs?: () => void;
  shuffleSeed?: string;
}



function shuffle<T>(arr: T[]): T[] {

  const a = [...arr];

  for (let i = a.length - 1; i > 0; i--) {

    const j = Math.floor(Math.random() * (i + 1));

    [a[i], a[j]] = [a[j], a[i]];

  }

  return a;

}



export function QuizGame({

  pairs,

  locale,

  examMode,

  deckId,

  stepIndex,

  onComplete,

  onExit,

  onNotEnoughPairs,
  shuffleSeed,
}: QuizGameProps) {
  const quizPool = useMemo(() => getQuizPool(pairs), [pairs]);

  const questions = useMemo(() => {
    const ordered = shuffleSeed
      ? seededShuffle(quizPool, `${shuffleSeed}-questions`)
      : shuffle(quizPool);
    return ordered.slice(0, Math.min(6, quizPool.length));
  }, [quizPool, shuffleSeed]);



  const [index, setIndex] = useState(0);

  const [score, setScore] = useState(0);

  const [selected, setSelected] = useState<string | null>(null);

  const [revealed, setRevealed] = useState(false);

  const timerSeconds = examMode ? getExamTimerSeconds('quiz', questions.length) : 0;

  const [timeLeft, setTimeLeft] = useState(timerSeconds);

  const scoreRef = useRef(0);

  scoreRef.current = score;

  const notifiedRef = useRef(false);



  useEffect(() => {

    if (!hasEnoughQuizPairsRelaxed(pairs) && !notifiedRef.current) {

      notifiedRef.current = true;

      onNotEnoughPairs?.();

    }

  }, [pairs, onNotEnoughPairs]);



  const q = questions[index];

  const options = useMemo(() => {

    if (!q || quizPool.length < MIN_QUIZ_PAIRS_RELAXED) return [];

    return pickQuizOptions(q, quizPool, 3, shuffleSeed);
  }, [q, quizPool, shuffleSeed]);



  useEffect(() => {

    if (!examMode) return;

    setTimeLeft(timerSeconds);

    const timer = setInterval(() => {

      setTimeLeft((tLeft) => {

        if (tLeft <= 1) {

          onComplete(scoreRef.current, questions.length);

          return 0;

        }

        if (tLeft <= 11) playSound('examTick');

        return tLeft - 1;

      });

    }, 1000);

    return () => clearInterval(timer);

  }, [examMode, onComplete, questions.length, timerSeconds]);



  const finish = useCallback(

    (finalScore: number) => onComplete(finalScore, questions.length),

    [onComplete, questions.length],

  );



  const pick = (opt: string) => {

    if (revealed || !q) return;

    setSelected(opt);

    setRevealed(true);

    const correct = opt === q.definition;

    const newScore = score + (correct ? 1 : 0);

    if (correct) {

      addCorrectAnswer();

      markCorrected(q);

      vibrateSuccess();

      playGameCorrectSound(stepIndex != null);

    } else {

      markDifficult(q);

      recordMistake(q, 'quiz', deckId ?? undefined, stepIndex ?? undefined);

      vibrateError();

      playSound('wrong');

    }

    setScore(newScore);

    const delay = examMode ? 900 : 600;

    setTimeout(() => {

      if (index >= questions.length - 1) {

        finish(newScore);

      } else {

        setIndex((i) => i + 1);

        setSelected(null);

        setRevealed(false);

      }

    }, delay);

  };



  if (quizPool.length < MIN_QUIZ_PAIRS_RELAXED || questions.length === 0) {

    return (

      <div className="screen game-screen flow-screen">

        <GameHeader locale={locale} onExit={onExit} progress={0} />

        <div className="game-body quiz-body">

          <p className="quiz-empty-msg">{t('stepNeedMoreWords', locale)}</p>

          <button type="button" className="btn-primary" onClick={onExit}>

            {t('back', locale)}

          </button>

        </div>

      </div>

    );

  }



  if (!q) return null;



  return (

    <div className="screen game-screen flow-screen">

      <GameHeader
        locale={locale}
        onExit={onExit}
        progress={gameProgressPct(index + 1, questions.length)}
        examMode={examMode}
        timeLeft={timeLeft}
      />



      <div className="game-body quiz-body">

        <p className="quiz-prompt">{t('quizPrompt', locale)}</p>

        <div className="quiz-term-row">
          <h2 className="quiz-term">{q.term}</h2>
          <HearButton text={q.term} lang={resolveSpeakLang(q)} locale={locale} />
        </div>

        <div className="quiz-options">

          {options.map((opt) => {

            let cls = 'quiz-option';

            if (revealed && opt === q.definition) cls += ' correct';

            else if (revealed && opt === selected && opt !== q.definition) cls += ' wrong';

            return (

              <button key={opt} type="button" className={cls} onClick={() => pick(opt)} disabled={revealed}>

                {opt}

              </button>

            );

          })}

        </div>

      </div>

    </div>

  );

}

