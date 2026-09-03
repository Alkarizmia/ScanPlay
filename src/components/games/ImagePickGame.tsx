import { useCallback, useEffect, useMemo, useState } from 'react';
import { registerAnswer } from '../../lib/gameFeedback';
import { t } from '../../lib/i18n';
import { buildImagePickRounds } from '../../lib/imagePickRounds';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { coercePlayablePairs } from '../../lib/vocabulary';
import type { Locale, WordPair } from '../../types';
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';
import { AnswerFeedback } from './AnswerFeedback';
import { ChoiceCard, type ChoiceState } from './ChoiceCard';

interface ImagePickGameProps extends EmbeddedGameProps {
  pairs: WordPair[];
  locale: Locale;
  deckId?: string | null;
  stepIndex?: number | null;
  onComplete: (score: number, total: number) => void;
  onExit: () => void;
}

export function ImagePickGame({
  pairs,
  locale,
  deckId,
  stepIndex,
  onComplete,
  onExit,
  embedded = false,
  onStepProgress,
  maxItems,
}: ImagePickGameProps) {
  const rounds = useMemo(
    () =>
      buildImagePickRounds(pairs, {
        maxRounds: Math.max(1, maxItems ?? 4),
        seed: deckId ?? 'imagepick',
      }),
    [pairs, maxItems, deckId],
  );
  const pool = useMemo(() => coercePlayablePairs(pairs), [pairs]);

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [lastXp, setLastXp] = useState(0);

  const round = rounds[index];
  const total = Math.max(1, rounds.length);

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, total);
  }, [embedded, onStepProgress, index, total]);

  const goNext = useCallback(
    (finalScore: number) => {
      setPicked(null);
      setLastXp(0);
      if (index + 1 >= rounds.length) onComplete(finalScore, total);
      else setIndex((i) => i + 1);
    },
    [index, onComplete, rounds.length, total],
  );

  const pick = (artId: string) => {
    if (!round || picked) return;
    setPicked(artId);
    const ok = artId === round.targetId;
    const nextScore = score + (ok ? 1 : 0);
    setScore(nextScore);
    setLastXp(registerAnswer(ok ? 'correct' : 'wrong', { pathStep: stepIndex != null }));

    const pair = pool[round.pairIndex];
    if (pair) {
      if (ok) markCorrected(pair);
      else recordMistake(pair, 'imagepick', deckId ?? undefined, stepIndex ?? undefined);
    }

    if (ok) window.setTimeout(() => goNext(nextScore), 650);
  };

  if (!round) return null;

  const missed = picked != null && picked !== round.targetId;
  const optionState = (artId: string): ChoiceState => {
    if (!picked) return 'idle';
    if (artId === round.targetId) return 'correct';
    if (artId === picked) return 'wrong';
    return 'muted';
  };

  return (
    <LessonGameShell
      embedded={embedded}
      locale={locale}
      onExit={onExit}
      progress={gameProgressPct(index, total)}
      className="imagepick-game"
      feedback={
        missed ? (
          <AnswerFeedback
            locale={locale}
            grade="wrong"
            answer={round.prompt}
            onContinue={() => goNext(score)}
          />
        ) : picked ? (
          <AnswerFeedback locale={locale} grade="correct" xp={lastXp} />
        ) : null
      }
    >
      <div className="game-body imagepick-body">
        <p className="game-instruction">{t('imagePickInstruction', locale)}</p>
        <h2 className="game-question imagepick-prompt">{round.prompt}</h2>
        <div className="imagepick-grid">
          {round.options.map((art, i) => (
            <ChoiceCard
              key={art.id}
              index={i}
              className="imagepick-card"
              state={optionState(art.id)}
              disabled={picked != null}
              onSelect={() => pick(art.id)}
              ariaLabel={art.id}
            >
              <img className="imagepick-art" src={art.src} alt="" draggable={false} />
            </ChoiceCard>
          ))}
        </div>
      </div>
    </LessonGameShell>
  );
}
