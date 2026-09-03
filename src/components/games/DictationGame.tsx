import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { registerAnswer } from '../../lib/gameFeedback';
import { t } from '../../lib/i18n';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { speakText } from '../../lib/speech';
import { buildDictationRounds } from '../../lib/dictationRounds';
import { coercePlayablePairs, gradeTypedAnswer, type AnswerGrade } from '../../lib/vocabulary';
import type { Locale, WordPair } from '../../types';
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';
import { AnswerFeedback } from './AnswerFeedback';

interface DictationGameProps extends EmbeddedGameProps {
  pairs: WordPair[];
  locale: Locale;
  deckId?: string | null;
  stepIndex?: number | null;
  onComplete: (score: number, total: number) => void;
  onExit: () => void;
}

export function DictationGame({
  pairs,
  locale,
  deckId,
  stepIndex,
  onComplete,
  onExit,
  embedded = false,
  onStepProgress,
  maxItems,
}: DictationGameProps) {
  const deck = useMemo(
    () =>
      buildDictationRounds(pairs, {
        maxRounds: Math.max(1, maxItems ?? 4),
        seed: deckId ?? 'dictation',
      }),
    [pairs, maxItems, deckId],
  );
  const pool = useMemo(() => coercePlayablePairs(pairs), [pairs]);

  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [grade, setGrade] = useState<AnswerGrade | null>(null);
  const [lastXp, setLastXp] = useState(0);
  const [score, setScore] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const round = deck[index];
  const current = round ? pool[round.pairIndex] : undefined;
  const total = Math.max(1, deck.length);

  const play = useCallback(
    (slow = false) => {
      if (!round) return;
      void speakText(round.spoken, round.lang, slow ? { rate: 0.65 } : undefined);
    },
    [round],
  );

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, total);
  }, [embedded, onStepProgress, index, total]);

  useEffect(() => {
    if (!round) return;
    const timer = window.setTimeout(() => play(), 350);
    inputRef.current?.focus();
    return () => window.clearTimeout(timer);
  }, [round, play]);

  const submit = () => {
    if (!round || !current || grade || !input.trim()) return;
    const result = round.accepted.reduce<AnswerGrade>((best, accepted) => {
      if (best === 'correct') return best;
      const next = gradeTypedAnswer(input, accepted);
      if (next === 'correct') return 'correct';
      if (next === 'near') return 'near';
      return best;
    }, 'wrong');
    setGrade(result);
    setLastXp(registerAnswer(result, { pathStep: stepIndex != null }));

    if (result === 'correct') {
      setScore((s) => s + 1);
      markCorrected(current);
    } else if (result === 'near') {
      setScore((s) => s + 0.5);
    } else {
      recordMistake(current, 'dictation', deckId ?? undefined, stepIndex ?? undefined);
    }
  };

  const next = () => {
    const finalScore = score;
    setInput('');
    setGrade(null);
    setLastXp(0);
    if (index + 1 >= deck.length) onComplete(finalScore, total);
    else setIndex((i) => i + 1);
  };

  if (!round || !current) return null;

  return (
    <LessonGameShell
      embedded={embedded}
      locale={locale}
      onExit={onExit}
      progress={gameProgressPct(index, total)}
      className="dictation-game"
      feedback={
        grade ? (
          <AnswerFeedback
            locale={locale}
            grade={grade}
            xp={lastXp}
            answer={grade === 'correct' ? undefined : round.accepted.join(' / ')}
            note={grade === 'near' ? t('typeNearHint', locale) : undefined}
            onContinue={next}
            continueLabel={index >= deck.length - 1 ? t('typeFinish', locale) : t('typeNext', locale)}
          />
        ) : null
      }
    >
      <div className="game-body dictation-body">
        <p className="game-instruction">{t('dictationInstruction', locale)}</p>

        <div className="listen-audio-card" key={index}>
          <span className="listen-audio-icon" aria-hidden="true">
            🎧
          </span>
          <button type="button" className="btn-primary listen-hear-btn" onClick={() => play()}>
            {t('dictationReplay', locale)}
          </button>
          <button type="button" className="btn-ghost dictation-slow" onClick={() => play(true)}>
            {t('dictationSlow', locale)}
          </button>
        </div>

        <label className="field-label" htmlFor="dictation-answer">
          {t('typeAnswerLabel', locale)}
        </label>
        <input
          id="dictation-answer"
          ref={inputRef}
          className="field-input type-game-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (grade) next();
            else submit();
          }}
          placeholder={t('dictationPlaceholder', locale)}
          disabled={grade != null}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      {!grade && (
        <div className="game-actions">
          <button
            type="button"
            className="btn-primary btn-lg"
            onClick={submit}
            disabled={!input.trim()}
          >
            {t('typeCheck', locale)}
          </button>
        </div>
      )}
    </LessonGameShell>
  );
}
