import { useCallback, useEffect, useMemo, useState } from 'react';
import { registerAnswer } from '../../lib/gameFeedback';
import { playSound } from '../../lib/sounds';
import { t } from '../../lib/i18n';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { buildReorderRounds } from '../../lib/reorderRounds';
import { coercePlayablePairs } from '../../lib/vocabulary';
import type { Locale, WordPair } from '../../types';
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';
import { AnswerFeedback } from './AnswerFeedback';

interface ReorderGameProps extends EmbeddedGameProps {
  pairs: WordPair[];
  locale: Locale;
  deckId?: string | null;
  stepIndex?: number | null;
  onComplete: (score: number, total: number) => void;
  onExit: () => void;
}

/** Rebuild a sentence word by word — production practice that works on notes sheets. */
export function ReorderGame({
  pairs,
  locale,
  deckId,
  stepIndex,
  onComplete,
  onExit,
  embedded = false,
  onStepProgress,
  maxItems,
}: ReorderGameProps) {
  const rounds = useMemo(
    () =>
      buildReorderRounds(pairs, {
        maxRounds: Math.max(1, maxItems ?? 3),
        seed: deckId ?? 'reorder',
      }),
    [pairs, maxItems, deckId],
  );
  const pool = useMemo(() => coercePlayablePairs(pairs), [pairs]);

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [grade, setGrade] = useState<'correct' | 'wrong' | null>(null);
  const [lastXp, setLastXp] = useState(0);
  const [score, setScore] = useState(0);

  const round = rounds[index];
  const total = Math.max(1, rounds.length);

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, total);
  }, [embedded, onStepProgress, index, total]);

  const goNext = useCallback(
    (finalScore: number) => {
      setPicked([]);
      setGrade(null);
      setLastXp(0);
      if (index + 1 >= rounds.length) onComplete(finalScore, total);
      else setIndex((i) => i + 1);
    },
    [index, onComplete, rounds.length, total],
  );

  if (!round) return null;

  const tileById = new Map(round.tiles.map((tile) => [tile.id, tile]));
  const complete = picked.length === round.expected.length;

  const takeTile = (id: string) => {
    if (grade) return;
    playSound('tap');
    setPicked((current) => (current.includes(id) ? current : [...current, id]));
  };

  const returnTile = (id: string) => {
    if (grade) return;
    playSound('tap');
    setPicked((current) => current.filter((tileId) => tileId !== id));
  };

  const check = () => {
    if (!complete || grade) return;
    const answer = picked.map((id) => tileById.get(id)?.text ?? '');
    const ok = answer.join(' ').toLowerCase() === round.expected.join(' ').toLowerCase();
    const nextScore = score + (ok ? 1 : 0);
    setScore(nextScore);
    setGrade(ok ? 'correct' : 'wrong');
    setLastXp(registerAnswer(ok ? 'correct' : 'wrong', { pathStep: stepIndex != null }));

    const pair = pool[round.pairIndex];
    if (pair) {
      if (ok) markCorrected(pair);
      else recordMistake(pair, 'reorder', deckId ?? undefined, stepIndex ?? undefined);
    }

    if (ok) window.setTimeout(() => goNext(nextScore), 800);
  };

  return (
    <LessonGameShell
      embedded={embedded}
      locale={locale}
      onExit={onExit}
      progress={gameProgressPct(index, total)}
      className="reorder-game"
      feedback={
        grade === 'wrong' ? (
          <AnswerFeedback
            locale={locale}
            grade="wrong"
            answer={round.expected.join(' ')}
            onContinue={() => goNext(score)}
          />
        ) : grade === 'correct' ? (
          <AnswerFeedback locale={locale} grade="correct" xp={lastXp} />
        ) : null
      }
    >
      <main className="game-main reorder-main scroll-natural">
        <p className="game-instruction">{t('reorderInstruction', locale)}</p>

        <p className="reorder-clue" key={index}>
          {round.clue}
        </p>

        <div className="reorder-answer" aria-label={t('reorderInstruction', locale)}>
          {picked.length === 0 ? (
            <span className="reorder-answer-empty">&nbsp;</span>
          ) : (
            picked.map((id) => (
              <button
                key={id}
                type="button"
                className="translate-tile reorder-tile reorder-tile--placed"
                onClick={() => returnTile(id)}
                disabled={grade != null}
              >
                {tileById.get(id)?.text}
              </button>
            ))
          )}
        </div>

        <div className="reorder-bank">
          {round.tiles
            .filter((tile) => !picked.includes(tile.id))
            .map((tile) => (
              <button
                key={tile.id}
                type="button"
                className="translate-tile reorder-tile"
                onClick={() => takeTile(tile.id)}
                disabled={grade != null}
              >
                {tile.text}
              </button>
            ))}
        </div>
      </main>

      {!grade && (
        <div className="game-actions">
          <button type="button" className="btn-primary btn-lg" onClick={check} disabled={!complete}>
            {t('reorderCheck', locale)}
          </button>
        </div>
      )}
    </LessonGameShell>
  );
}
