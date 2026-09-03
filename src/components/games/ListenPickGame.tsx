import { useCallback, useEffect, useMemo, useState } from 'react';
import { registerAnswer } from '../../lib/gameFeedback';
import { t } from '../../lib/i18n';
import { buildListenPickRounds } from '../../lib/listenPickRounds';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { speakText } from '../../lib/speech';
import { coercePlayablePairs } from '../../lib/vocabulary';
import type { Locale, WordPair } from '../../types';
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';
import { AnswerFeedback } from './AnswerFeedback';
import { ChoiceCard, type ChoiceState } from './ChoiceCard';

interface ListenPickGameProps extends EmbeddedGameProps {
  pairs: WordPair[];
  locale: Locale;
  deckId?: string | null;
  stepIndex?: number | null;
  onComplete: (score: number, total: number) => void;
  onExit: () => void;
}

/** Hear a word in one language, pick its match from the scanned list in the other. */
export function ListenPickGame({
  pairs,
  locale,
  deckId,
  stepIndex,
  onComplete,
  onExit,
  embedded = false,
  onStepProgress,
  maxItems,
}: ListenPickGameProps) {
  const rounds = useMemo(
    () =>
      buildListenPickRounds(pairs, {
        maxRounds: Math.max(1, maxItems ?? 4),
        seed: deckId ?? 'listenpick',
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

  const play = useCallback(() => {
    if (round) void speakText(round.spoken, round.lang);
  }, [round]);

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, total);
  }, [embedded, onStepProgress, index, total]);

  useEffect(() => {
    if (!round) return;
    const timer = window.setTimeout(play, 350);
    return () => window.clearTimeout(timer);
  }, [round, play]);

  const goNext = useCallback(
    (finalScore: number) => {
      setPicked(null);
      setLastXp(0);
      if (index + 1 >= rounds.length) onComplete(finalScore, total);
      else setIndex((i) => i + 1);
    },
    [index, onComplete, rounds.length, total],
  );

  const pick = (option: string) => {
    if (!round || picked) return;
    setPicked(option);

    const ok = option === round.target;
    const nextScore = score + (ok ? 1 : 0);
    setScore(nextScore);
    setLastXp(registerAnswer(ok ? 'correct' : 'wrong', { pathStep: stepIndex != null }));

    const pair = pool[round.pairIndex];
    if (pair) {
      if (ok) markCorrected(pair);
      else recordMistake(pair, 'listenpick', deckId ?? undefined, stepIndex ?? undefined);
    }

    if (ok) window.setTimeout(() => goNext(nextScore), 650);
  };

  if (!round) return null;

  const missed = picked != null && picked !== round.target;
  const meaning = pool[round.pairIndex]
    ? `${round.spoken} → ${round.target}`
    : undefined;

  const optionState = (option: string): ChoiceState => {
    if (!picked) return 'idle';
    if (option === round.target) return 'correct';
    if (option === picked) return 'wrong';
    return 'muted';
  };

  return (
    <LessonGameShell
      embedded={embedded}
      locale={locale}
      onExit={onExit}
      progress={gameProgressPct(index, total)}
      className="listen-game listenpick-game"
      feedback={
        missed ? (
          <AnswerFeedback
            locale={locale}
            grade="wrong"
            answer={round.target}
            note={meaning}
            onContinue={() => goNext(score)}
          />
        ) : picked ? (
          <AnswerFeedback locale={locale} grade="correct" xp={lastXp} note={meaning} />
        ) : null
      }
    >
      <div className="game-body listen-game-body">
        <p className="game-instruction">{t('listenPickInstruction', locale)}</p>

        <div className="listen-audio-card" key={index}>
          <span className="listen-audio-icon" aria-hidden="true">
            🎧
          </span>
          <button type="button" className="btn-primary listen-hear-btn" onClick={play}>
            {t('dictationReplay', locale)}
          </button>
          <p className="listen-audio-hint">{t('listenTapToReplay', locale)}</p>
        </div>

        <div className="choice-list listen-options">
          {round.options.map((option, i) => (
            <ChoiceCard
              key={option}
              index={i}
              state={optionState(option)}
              disabled={picked != null}
              onSelect={() => pick(option)}
            >
              {option}
            </ChoiceCard>
          ))}
        </div>
      </div>
    </LessonGameShell>
  );
}
