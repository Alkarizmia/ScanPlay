import { useCallback, useEffect, useMemo, useState } from 'react';
import { playGameCorrectSound, playSound } from '../../lib/sounds';
import { vibrateError, vibrateSuccess } from '../../lib/haptics';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { FormulaText } from '../FormulaText';
import { t } from '../../lib/i18n';
import { getQuizPool, hasEnoughTrueFalsePairs } from '../../lib/vocabulary';
import { buildTrueFalseRounds } from '../../lib/trueFalseRounds';
import type { Locale, WordPair } from '../../types';
import { gameProgressPct, GameHeader } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';

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
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  if (!hasEnoughTrueFalsePairs(pairs) || rounds.length === 0) {
    onNotEnoughPairs?.();
    return null;
  }

  const round = rounds[index];
  const total = rounds.length;

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, total);
  }, [embedded, onStepProgress, index, total]);

  const finish = useCallback(() => {
    onComplete(score, total);
  }, [onComplete, score, total]);

  const answer = (choice: boolean) => {
    if (!round || feedback) return;
    const ok = choice === round.isTrue;
    if (ok) {
      setScore((s) => s + 1);
      playGameCorrectSound(stepIndex != null);
      vibrateSuccess();
      const pair = getQuizPool(pairs)[round.pairIndex];
      if (pair) markCorrected(pair);
    } else {
      playSound('wrong');
      vibrateError();
      const pair = getQuizPool(pairs)[round.pairIndex];
      if (pair) recordMistake(pair, 'truefalse', deckId ?? undefined, stepIndex ?? undefined);
    }
    setFeedback(ok ? 'correct' : 'wrong');
    window.setTimeout(() => {
      setFeedback(null);
      if (index + 1 >= total) finish();
      else setIndex((i) => i + 1);
    }, 520);
  };

  if (!round) {
    onComplete(0, 1);
    return null;
  }

  const body = (
    <main className="game-main scroll-natural">
      <p className="game-instruction">{t('trueFalseInstruction', locale)}</p>
      <div className="truefalse-card">
        <FormulaText className="truefalse-term" text={round.term} />
        <p className="truefalse-statement">
          = <FormulaText text={round.statement} />
        </p>
      </div>
      <div className="truefalse-actions">
        <button
          type="button"
          className={`truefalse-btn truefalse-btn--true${feedback === 'correct' && round.isTrue ? ' is-correct' : ''}${feedback === 'wrong' && !round.isTrue ? ' is-wrong' : ''}`}
          onClick={() => answer(true)}
          disabled={!!feedback}
        >
          {t('trueLabel', locale)}
        </button>
        <button
          type="button"
          className={`truefalse-btn truefalse-btn--false${feedback === 'correct' && !round.isTrue ? ' is-correct' : ''}${feedback === 'wrong' && round.isTrue ? ' is-wrong' : ''}`}
          onClick={() => answer(false)}
          disabled={!!feedback}
        >
          {t('falseLabel', locale)}
        </button>
      </div>
    </main>
  );

  if (embedded) {
    return <div className="lesson-embedded-pane truefalse-game">{body}</div>;
  }

  return (
    <div className="screen game-screen truefalse-game">
      <GameHeader
        locale={locale}
        onExit={onExit}
        progress={gameProgressPct(index, total)}
        examMode={examMode}
      />
      {body}
    </div>
  );
}
