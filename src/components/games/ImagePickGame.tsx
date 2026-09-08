import { useCallback, useEffect, useMemo, useState } from 'react';
import { registerAnswer } from '../../lib/gameFeedback';
import { t } from '../../lib/i18n';
import { buildImagePickRounds } from '../../lib/imagePickRounds';
import { preloadImages } from '../../lib/preloadImages';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { coercePlayablePairs, flipPair, isReversedStep } from '../../lib/vocabulary';
import type { Locale, PairDirection, WordPair } from '../../types';
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
  pairDirection?: PairDirection;
  onComplete: (score: number, total: number) => void;
  onExit: () => void;
}

export function ImagePickGame({
  pairs,
  locale,
  deckId,
  stepIndex,
  pairDirection = 'auto',
  onComplete,
  onExit,
  embedded = false,
  onStepProgress,
  maxItems,
}: ImagePickGameProps) {
  const scannedPairs = useMemo(
    () => (isReversedStep(stepIndex ?? null, pairDirection) ? pairs.map(flipPair) : pairs),
    [pairs, stepIndex, pairDirection],
  );
  const rounds = useMemo(
    () =>
      buildImagePickRounds(scannedPairs, {
        maxRounds: Math.max(1, maxItems ?? 4),
        seed: deckId ?? 'imagepick',
      }),
    [scannedPairs, maxItems, deckId],
  );
  const pool = useMemo(() => coercePlayablePairs(scannedPairs), [scannedPairs]);

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [lastXp, setLastXp] = useState(0);
  const [artsReady, setArtsReady] = useState(false);

  const round = rounds[index];
  const total = Math.max(1, rounds.length);

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, total);
  }, [embedded, onStepProgress, index, total]);

  useEffect(() => {
    const srcs = [...new Set(rounds.flatMap((item) => item.options.map((art) => art.src)))];
    void preloadImages(srcs);
  }, [rounds]);

  useEffect(() => {
    if (!round) return;
    let cancelled = false;
    setArtsReady(false);
    const current = round.options.map((art) => art.src);
    const next = rounds[index + 1]?.options.map((art) => art.src) ?? [];
    void preloadImages(current).then(() => {
      if (!cancelled) setArtsReady(true);
    });
    if (next.length) void preloadImages(next);
    const fallback = window.setTimeout(() => {
      if (!cancelled) setArtsReady(true);
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, [round, index, rounds]);

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
        <div className={`imagepick-grid${artsReady ? ' is-ready' : ''}`} aria-busy={!artsReady}>
          {artsReady
            ? round.options.map((art) => (
                <ChoiceCard
                  key={art.id}
                  index={0}
                  className="imagepick-card"
                  state={optionState(art.id)}
                  disabled={picked != null}
                  onSelect={() => pick(art.id)}
                  ariaLabel={art.id}
                >
                  <img
                    className="imagepick-art"
                    src={art.src}
                    alt=""
                    draggable={false}
                    decoding="async"
                    fetchPriority="high"
                  />
                </ChoiceCard>
              ))
            : [0, 1, 2, 3].map((slot) => <span key={slot} className="imagepick-slot" />)}
        </div>
      </div>
    </LessonGameShell>
  );
}
