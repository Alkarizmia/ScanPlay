import { useCallback, useEffect, useMemo, useState } from 'react';
import { playGameCorrectSound, playSound } from '../../lib/sounds';
import { vibrateError, vibrateSuccess } from '../../lib/haptics';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { t } from '../../lib/i18n';
import { getQuizPool, hasEnoughQuizPairsRelaxed } from '../../lib/vocabulary';
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

interface Round {
  term: string;
  statement: string;
  isTrue: boolean;
  pairIndex: number;
}

function buildRounds(pairs: WordPair[]): Round[] {
  const pool = getQuizPool(pairs).slice(0, 8);
  const rounds: Round[] = [];
  const others = pool.map((p) => p.definition);

  for (let i = 0; i < pool.length; i++) {
    const pair = pool[i]!;
    const showTrue = Math.random() < 0.55;
    let statement = pair.definition;
    if (!showTrue) {
      const alt = others.filter((d) => d !== pair.definition);
      statement = alt[Math.floor(Math.random() * alt.length)] ?? pair.definition;
    }
    rounds.push({
      term: pair.term,
      statement,
      isTrue: statement === pair.definition,
      pairIndex: i,
    });
  }
  return rounds;
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
}: TrueFalseGameProps) {
  const rounds = useMemo(() => buildRounds(pairs), [pairs]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  if (!hasEnoughQuizPairsRelaxed(pairs)) {
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
        <span className="truefalse-term">{round.term}</span>
        <p className="truefalse-statement">= {round.statement}</p>
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
