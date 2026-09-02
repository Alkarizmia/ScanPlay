import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getExamTimerSeconds } from '../../lib/examTimer';
import { playSound } from '../../lib/sounds';
import { registerAnswer } from '../../lib/gameFeedback';
import { t } from '../../lib/i18n';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { HearButton } from '../HearButton';
import { FormulaText } from '../FormulaText';
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
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';
import { AnswerFeedback } from './AnswerFeedback';
import { ChoiceCard, type ChoiceState } from './ChoiceCard';

interface QuizGameProps extends EmbeddedGameProps {
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
  embedded = false,
  onStepProgress,
  maxItems,
}: QuizGameProps) {
  const quizPool = useMemo(() => getQuizPool(pairs), [pairs]);

  const questions = useMemo(() => {
    const ordered = shuffleSeed
      ? seededShuffle(quizPool, `${shuffleSeed}-questions`)
      : shuffle(quizPool);
    const cap = examMode ? Math.min(12, quizPool.length) : Math.min(maxItems ?? 6, quizPool.length);
    return ordered.slice(0, cap);
  }, [quizPool, shuffleSeed, examMode, maxItems]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [lastXp, setLastXp] = useState(0);
  const timerSeconds = examMode ? getExamTimerSeconds('quiz', questions.length) : 0;
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const scoreRef = useRef(0);
  scoreRef.current = score;
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, questions.length);
  }, [embedded, onStepProgress, index, questions.length]);

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

  const advance = useCallback(
    (finalScore: number) => {
      if (index >= questions.length - 1) {
        onComplete(finalScore, questions.length);
        return;
      }
      setIndex((i) => i + 1);
      setSelected(null);
      setRevealed(false);
      setLastXp(0);
    },
    [index, onComplete, questions.length],
  );

  const pick = (opt: string) => {
    if (revealed || !q) return;
    setSelected(opt);
    setRevealed(true);

    const correct = opt === q.definition;
    const newScore = score + (correct ? 1 : 0);
    setScore(newScore);
    scoreRef.current = newScore;
    setLastXp(registerAnswer(correct ? 'correct' : 'wrong', { pathStep: stepIndex != null }));

    if (correct) {
      markCorrected(q);
      // Right answers keep the rhythm; misses wait for a tap so the answer is read.
      window.setTimeout(() => advance(newScore), examMode ? 800 : 620);
      return;
    }

    markDifficult(q);
    recordMistake(q, 'quiz', deckId ?? undefined, stepIndex ?? undefined);
  };

  if (quizPool.length < MIN_QUIZ_PAIRS_RELAXED || questions.length === 0) {
    return (
      <LessonGameShell embedded={embedded} locale={locale} onExit={onExit} progress={0}>
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
      feedback={
        missed ? (
          <AnswerFeedback
            locale={locale}
            grade="wrong"
            answer={<FormulaText text={q.definition} />}
            onContinue={() => advance(score)}
          />
        ) : revealed ? (
          <AnswerFeedback locale={locale} grade="correct" xp={lastXp} />
        ) : null
      }
    >
      <div className="game-body quiz-body">
        <div className="game-prompt" key={index}>
          <span className="game-eyebrow">{t('quizPrompt', locale)}</span>
          <h2 className="game-question quiz-term">
            <FormulaText text={q.term} />
            <HearButton text={q.term} lang={resolveSpeakLang(q)} locale={locale} iconOnly />
          </h2>
        </div>

        <div className="choice-list quiz-options">
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
    </LessonGameShell>
  );
}
