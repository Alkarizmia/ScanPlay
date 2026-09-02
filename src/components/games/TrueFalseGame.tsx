import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { registerAnswer } from '../../lib/gameFeedback';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { FormulaText } from '../FormulaText';
import { t } from '../../lib/i18n';
import { getQuizPool, hasEnoughTrueFalsePairs } from '../../lib/vocabulary';
import { buildTrueFalseRounds } from '../../lib/trueFalseRounds';
import type { Locale, WordPair } from '../../types';
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';
import { AnswerFeedback } from './AnswerFeedback';

interface TrueFalseGameProps extends EmbeddedGameProps {
  pairs: WordPair[];
  locale: Locale;
  examMode?: boolean;
  deckId?: string | null;
  stepIndex?: number | null;
  onComplete: (score: number, total: number) => void;
  onExit: () => void;
  onNotEnoughPairs?: () => void;
}

export function TrueFalseGame({
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
}: TrueFalseGameProps) {
  const rounds = useMemo(
    () =>
      buildTrueFalseRounds(pairs, {
        maxRounds: examMode ? 8 : maxItems,
      }),
    [pairs, examMode, maxItems],
  );
  const playable = hasEnoughTrueFalsePairs(pairs) && rounds.length > 0;

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [lastXp, setLastXp] = useState(0);
  const notifiedRef = useRef(false);

  const round = rounds[index];
  const total = Math.max(1, rounds.length);

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, total);
  }, [embedded, onStepProgress, index, total]);

  useEffect(() => {
    if (!playable && !notifiedRef.current) {
      notifiedRef.current = true;
      onNotEnoughPairs?.();
    }
  }, [playable, onNotEnoughPairs]);

  const finish = useCallback(
    (finalScore: number) => onComplete(finalScore, total),
    [onComplete, total],
  );

  const answer = (choice: boolean) => {
    if (!round || feedback) return;
    const ok = choice === round.isTrue;
    const nextScore = score + (ok ? 1 : 0);
    setScore(nextScore);
    setLastXp(registerAnswer(ok ? 'correct' : 'wrong', { pathStep: stepIndex != null }));

    const pair = getQuizPool(pairs)[round.pairIndex];
    if (pair) {
      if (ok) markCorrected(pair);
      else recordMistake(pair, 'truefalse', deckId ?? undefined, stepIndex ?? undefined);
    }

    setFeedback(ok ? 'correct' : 'wrong');
    window.setTimeout(
      () => {
        setFeedback(null);
        setLastXp(0);
        if (index + 1 >= total) finish(nextScore);
        else setIndex((i) => i + 1);
      },
      ok ? 620 : 1150,
    );
  };

  if (!playable || !round) return null;

  const trueState =
    feedback && round.isTrue ? 'is-correct' : feedback && !round.isTrue ? 'is-wrong' : '';
  const falseState =
    feedback && !round.isTrue ? 'is-correct' : feedback && round.isTrue ? 'is-wrong' : '';

  return (
    <LessonGameShell
      embedded={embedded}
      locale={locale}
      onExit={onExit}
      progress={gameProgressPct(index, total)}
      examMode={examMode}
      className="truefalse-game"
      feedback={
        feedback ? (
          <AnswerFeedback
            locale={locale}
            grade={feedback}
            xp={lastXp}
            answer={
              feedback === 'wrong' ? (
                <FormulaText text={round.isTrue ? t('trueLabel', locale) : t('falseLabel', locale)} />
              ) : undefined
            }
          />
        ) : null
      }
    >
      <main className="game-main scroll-natural">
        <p className="game-instruction">{t('trueFalseInstruction', locale)}</p>
        <div className="truefalse-card" key={index}>
          <FormulaText className="truefalse-term" text={round.term} />
          <p className="truefalse-statement">
            = <FormulaText text={round.statement} />
          </p>
        </div>
        <div className="truefalse-actions">
          <button
            type="button"
            className={`truefalse-btn truefalse-btn--true ${trueState}`.trim()}
            onClick={() => answer(true)}
            disabled={!!feedback}
          >
            {t('trueLabel', locale)}
          </button>
          <button
            type="button"
            className={`truefalse-btn truefalse-btn--false ${falseState}`.trim()}
            onClick={() => answer(false)}
            disabled={!!feedback}
          >
            {t('falseLabel', locale)}
          </button>
        </div>
      </main>
    </LessonGameShell>
  );
}
