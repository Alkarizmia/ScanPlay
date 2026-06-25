import { useCallback, useEffect, useMemo, useState } from 'react';
import { playGameCorrectSound, playSound } from '../../lib/sounds';
import { vibrateError, vibrateSuccess } from '../../lib/haptics';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { t } from '../../lib/i18n';
import { getQuizPool, hasEnoughQuizPairsRelaxed } from '../../lib/vocabulary';
import type { Locale, WordPair } from '../../types';
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';

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

function buildRounds(pairs: WordPair[]): ClozeRound[] {
  const pool = getQuizPool(pairs).slice(0, 7);
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
}: ClozeGameProps) {
  const rounds = useMemo(() => buildRounds(pairs), [pairs]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  if (!hasEnoughQuizPairsRelaxed(pairs)) {
    onNotEnoughPairs?.();
    return null;
  }

  const round = rounds[index];
  const total = Math.max(1, rounds.length);

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, total);
  }, [embedded, onStepProgress, index, total]);

  const finish = useCallback(() => {
    onComplete(score, total);
  }, [onComplete, score, total]);

  const pick = (word: string) => {
    if (!round || picked) return;
    setPicked(word);
    const ok = word.toLowerCase() === round.correct.toLowerCase();
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
      if (pair) recordMistake(pair, 'cloze', deckId ?? undefined, stepIndex ?? undefined);
    }
    window.setTimeout(() => {
      setPicked(null);
      if (index + 1 >= rounds.length) finish();
      else setIndex((i) => i + 1);
    }, 600);
  };

  if (!round) {
    onComplete(0, 1);
    return null;
  }

  return (
    <LessonGameShell
      embedded={embedded}
      locale={locale}
      onExit={onExit}
      progress={gameProgressPct(index, total)}
      examMode={examMode}
      className="cloze-game"
    >
      <main className="game-main scroll-natural">
        <p className="game-instruction">{t('clozeInstruction', locale)}</p>
        <div className="cloze-prompt">
          <span className="cloze-term">{getQuizPool(pairs)[round.pairIndex]?.term}</span>
          <p className="cloze-sentence">{round.prompt}</p>
        </div>
        <div className="cloze-choices">
          {round.choices.map((word) => {
            const isPicked = picked === word;
            const isCorrect = word.toLowerCase() === round.correct.toLowerCase();
            let cls = 'cloze-choice';
            if (picked) {
              if (isCorrect) cls += ' is-correct';
              else if (isPicked) cls += ' is-wrong';
            }
            return (
              <button
                key={word}
                type="button"
                className={cls}
                onClick={() => pick(word)}
                disabled={!!picked}
              >
                {word}
              </button>
            );
          })}
        </div>
      </main>
    </LessonGameShell>
  );
}
