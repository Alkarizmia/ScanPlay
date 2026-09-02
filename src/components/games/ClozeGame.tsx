import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { registerAnswer } from '../../lib/gameFeedback';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { FormulaText } from '../FormulaText';
import { t } from '../../lib/i18n';
import { getQuizPool, hasEnoughQuizPairsRelaxed } from '../../lib/vocabulary';
import type { Locale, WordPair } from '../../types';
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';
import { AnswerFeedback } from './AnswerFeedback';
import { ChoiceCard, type ChoiceState } from './ChoiceCard';

interface ClozeGameProps extends EmbeddedGameProps {
  pairs: WordPair[];
  locale: Locale;
  examMode?: boolean;
  deckId?: string | null;
  stepIndex?: number | null;
  onComplete: (score: number, total: number) => void;
  onExit: () => void;
  onNotEnoughPairs?: () => void;
}

interface ClozeRound {
  prompt: string;
  choices: string[];
  correct: string;
  pairIndex: number;
}

function pickBlankWord(definition: string): string | null {
  const words = definition.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0) return null;
  return words[Math.floor(Math.random() * words.length)] ?? null;
}

function buildRounds(pairs: WordPair[], maxRounds = 7): ClozeRound[] {
  const pool = getQuizPool(pairs).slice(0, Math.max(maxRounds, 3));
  const rounds: ClozeRound[] = [];

  for (let i = 0; i < pool.length; i++) {
    const pair = pool[i]!;
    const blank = pickBlankWord(pair.definition);
    if (!blank) continue;
    const re = new RegExp(`\\b${blank.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const prompt = pair.definition.replace(re, '______');
    const distractors = pool
      .filter((_, j) => j !== i)
      .map((p) => pickBlankWord(p.definition))
      .filter((w): w is string => !!w && w.toLowerCase() !== blank.toLowerCase());
    const unique = [...new Set([blank, ...distractors])].slice(0, 3);
    while (unique.length < 3) unique.push(`${blank}${unique.length}`);
    for (let s = unique.length - 1; s > 0; s--) {
      const j = Math.floor(Math.random() * (s + 1));
      [unique[s], unique[j]] = [unique[j]!, unique[s]!];
    }
    rounds.push({ prompt, choices: unique, correct: blank, pairIndex: i });
    if (rounds.length >= maxRounds) break;
  }
  return rounds;
}

export function ClozeGame({
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
}: ClozeGameProps) {
  const pool = useMemo(() => getQuizPool(pairs), [pairs]);
  const rounds = useMemo(
    () => buildRounds(pairs, examMode ? 7 : maxItems),
    [pairs, examMode, maxItems],
  );
  const playable = hasEnoughQuizPairsRelaxed(pairs) && rounds.length > 0;

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
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

  const goNext = useCallback(
    (finalScore: number) => {
      setPicked(null);
      setLastXp(0);
      if (index + 1 >= rounds.length) finish(finalScore);
      else setIndex((i) => i + 1);
    },
    [finish, index, rounds.length],
  );

  const pick = (word: string) => {
    if (!round || picked) return;
    setPicked(word);
    const ok = word.toLowerCase() === round.correct.toLowerCase();
    const nextScore = score + (ok ? 1 : 0);
    setScore(nextScore);
    setLastXp(registerAnswer(ok ? 'correct' : 'wrong', { pathStep: stepIndex != null }));

    const pair = pool[round.pairIndex];
    if (pair) {
      if (ok) markCorrected(pair);
      else recordMistake(pair, 'cloze', deckId ?? undefined, stepIndex ?? undefined);
    }

    if (ok) window.setTimeout(() => goNext(nextScore), 620);
  };

  if (!playable || !round) return null;

  const missed = picked != null && picked.toLowerCase() !== round.correct.toLowerCase();

  const choiceState = (word: string): ChoiceState => {
    if (!picked) return 'idle';
    if (word.toLowerCase() === round.correct.toLowerCase()) return 'correct';
    if (word === picked) return 'wrong';
    return 'muted';
  };

  return (
    <LessonGameShell
      embedded={embedded}
      locale={locale}
      onExit={onExit}
      progress={gameProgressPct(index, total)}
      examMode={examMode}
      className="cloze-game"
      feedback={
        missed ? (
          <AnswerFeedback
            locale={locale}
            grade="wrong"
            answer={round.correct}
            onContinue={() => goNext(score)}
          />
        ) : picked ? (
          <AnswerFeedback locale={locale} grade="correct" xp={lastXp} />
        ) : null
      }
    >
      <main className="game-main scroll-natural">
        <p className="game-instruction">{t('clozeInstruction', locale)}</p>
        <div className="cloze-prompt" key={index}>
          <span className="cloze-term">
            <FormulaText text={pool[round.pairIndex]?.term ?? ''} />
          </span>
          <p className="cloze-sentence">{round.prompt}</p>
        </div>
        <div className="choice-list cloze-choices">
          {round.choices.map((word, i) => (
            <ChoiceCard
              key={word}
              index={i}
              state={choiceState(word)}
              disabled={picked != null}
              onSelect={() => pick(word)}
            >
              {word}
            </ChoiceCard>
          ))}
        </div>
      </main>
    </LessonGameShell>
  );
}
