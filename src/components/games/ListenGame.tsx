import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getExamTimerSeconds } from '../../lib/examTimer';
import { playSound } from '../../lib/sounds';
import { registerAnswer } from '../../lib/gameFeedback';
import { t } from '../../lib/i18n';
import { HearButton } from '../HearButton';
import { FormulaText } from '../FormulaText';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { speakText } from '../../lib/speech';
import { resolveSpeakLang } from '../../lib/speakLang';
import {
  getQuizPool,
  hasEnoughQuizPairsRelaxed,
  MIN_QUIZ_PAIRS_RELAXED,
  pickQuizOptions,
} from '../../lib/vocabulary';
import type { Locale, WordPair } from '../../types';
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';
import { GameSkipFooter } from './GameSkipFooter';
import { AnswerFeedback } from './AnswerFeedback';
import { ChoiceCard, type ChoiceState } from './ChoiceCard';

interface ListenGameProps extends EmbeddedGameProps {
  pairs: WordPair[];
  locale: Locale;
  examMode?: boolean;
  deckId?: string | null;
  stepIndex?: number | null;
  onComplete: (score: number, total: number) => void;
  onExit: () => void;
  onNotEnoughPairs?: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function ListenGame({
  pairs,
  locale,
  examMode,
  deckId,
  stepIndex,
  onComplete,
  onExit,
  onNotEnoughPairs,
  embedded = false,
  onStepProgress,
  maxItems,
}: ListenGameProps) {
  const quizPool = useMemo(() => getQuizPool(pairs), [pairs]);
  const questions = useMemo(() => {
    const cap = examMode ? Math.min(10, quizPool.length) : Math.min(maxItems ?? 6, quizPool.length);
    return shuffle(quizPool).slice(0, cap);
  }, [quizPool, examMode, maxItems]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [lastXp, setLastXp] = useState(0);
  const finishingRef = useRef(false);
  const notifiedRef = useRef(false);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  const q = questions[index];
  const options = useMemo(
    () => (q ? pickQuizOptions(q, quizPool, 3, `${deckId ?? 'listen'}-${index}`) : []),
    [q, quizPool, deckId, index],
  );
  const timerSeconds = examMode ? getExamTimerSeconds('listen', questions.length) : 0;
  const [timeLeft, setTimeLeft] = useState(timerSeconds);

  const finish = useCallback(
    (finalScore: number) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      onComplete(finalScore, questions.length);
    },
    [onComplete, questions.length],
  );

  const skip = useCallback(() => finish(scoreRef.current), [finish]);

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, questions.length);
  }, [embedded, onStepProgress, index, questions.length]);

  useEffect(() => {
    if (!hasEnoughQuizPairsRelaxed(pairs) && !notifiedRef.current) {
      notifiedRef.current = true;
      onNotEnoughPairs?.();
    }
  }, [pairs, onNotEnoughPairs]);

  useEffect(() => {
    if (!q) return;
    const timer = window.setTimeout(() => {
      void speakText(q.term, resolveSpeakLang(q));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [index, q]);

  useEffect(() => {
    if (!examMode || timerSeconds <= 0) return;
    setTimeLeft(timerSeconds);
    const timer = setInterval(() => {
      setTimeLeft((tVal) => {
        if (tVal <= 1) {
          finish(scoreRef.current);
          return 0;
        }
        if (tVal <= 11) playSound('examTick');
        return tVal - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [examMode, timerSeconds, finish]);

  const goNext = useCallback(
    (finalScore: number) => {
      setSelected(null);
      setRevealed(false);
      setLastXp(0);
      if (index + 1 >= questions.length) finish(finalScore);
      else setIndex((i) => i + 1);
    },
    [finish, index, questions.length],
  );

  const pick = (opt: string) => {
    if (!q || revealed) return;
    setSelected(opt);
    setRevealed(true);

    const ok = opt === q.definition;
    const nextScore = score + (ok ? 1 : 0);
    setScore(nextScore);
    scoreRef.current = nextScore;
    setLastXp(registerAnswer(ok ? 'correct' : 'wrong', { pathStep: stepIndex != null }));

    if (ok) {
      markCorrected(q);
      window.setTimeout(() => goNext(nextScore), 650);
      return;
    }
    recordMistake(q, 'listen', deckId ?? undefined, stepIndex ?? undefined);
  };

  if (quizPool.length < MIN_QUIZ_PAIRS_RELAXED || questions.length === 0) {
    return (
      <LessonGameShell embedded={embedded} locale={locale} onExit={onExit} progress={0} className="listen-game">
        <div className="game-body quiz-body">
          <p className="quiz-empty-msg">{t('stepNeedMoreWords', locale)}</p>
          <button type="button" className="btn-primary" onClick={onExit}>
            {t('back', locale)}
          </button>
        </div>
      </LessonGameShell>
    );
  }

  if (!q) return null;

  const missed = revealed && selected !== q.definition;

  const optionState = (opt: string): ChoiceState => {
    if (!revealed) return 'idle';
    if (opt === q.definition) return 'correct';
    if (opt === selected) return 'wrong';
    return 'muted';
  };

  return (
    <LessonGameShell
      embedded={embedded}
      locale={locale}
      onExit={onExit}
      progress={gameProgressPct(index + 1, questions.length)}
      examMode={examMode}
      timeLeft={timeLeft}
      className={`listen-game${embedded ? ' listen-game--embedded' : ''}`}
      feedback={
        missed ? (
          <AnswerFeedback
            locale={locale}
            grade="wrong"
            answer={<FormulaText text={q.definition} />}
            note={q.term}
            onContinue={() => goNext(score)}
          />
        ) : revealed ? (
          <AnswerFeedback locale={locale} grade="correct" xp={lastXp} answer={q.term} />
        ) : null
      }
    >
      <div className="game-body listen-game-body">
        <p className="game-instruction">{t('listenInstruction', locale)}</p>
        <div className="listen-audio-card" key={index}>
          <span className="listen-audio-icon" aria-hidden="true">
            🎧
          </span>
          <HearButton
            text={q.term}
            lang={resolveSpeakLang(q)}
            locale={locale}
            className="listen-hear-btn"
          />
          <p className="listen-audio-hint">{t('listenTapToReplay', locale)}</p>
        </div>
        <div className="choice-list listen-options">
          {options.map((opt, i) => (
            <ChoiceCard
              key={opt}
              index={i}
              state={optionState(opt)}
              disabled={revealed}
              onSelect={() => pick(opt)}
            >
              <FormulaText text={opt} />
            </ChoiceCard>
          ))}
        </div>
      </div>
      {embedded && <GameSkipFooter locale={locale} onSkip={skip} />}
    </LessonGameShell>
  );
}
