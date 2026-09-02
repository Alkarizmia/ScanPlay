import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HearButton } from '../HearButton';
import { ScanPlayMascot } from '../mascot/ScanPlayMascot';
import { playSound } from '../../lib/sounds';
import { registerAnswer } from '../../lib/gameFeedback';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { t } from '../../lib/i18n';
import { coercePlayablePairs } from '../../lib/vocabulary';
import { fetchAiTranslateRoundsTimed } from '../../lib/aiTranslate';
import {
  buildLocalTranslateRounds,
  gradeTranslateAnswer,
  highlightFocusParts,
  type TranslateGrade,
  type TranslateRound,
} from '../../lib/translateRounds';
import type { Locale, WordPair } from '../../types';
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';

interface TranslateGameProps extends EmbeddedGameProps {
  pairs: WordPair[];
  locale: Locale;
  examMode?: boolean;
  deckId?: string | null;
  stepIndex?: number | null;
  onComplete: (score: number, total: number) => void;
  onExit: () => void;
  onNotEnoughPairs?: () => void;
}

type Feedback = 'idle' | 'almost' | 'fail' | 'ok';

function mascotFor(feedback: Feedback): 'curious' | 'encouraging' | 'confused' | 'celebrating' {
  if (feedback === 'ok') return 'celebrating';
  if (feedback === 'almost') return 'encouraging';
  if (feedback === 'fail') return 'confused';
  return 'curious';
}

export function TranslateGame({
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
}: TranslateGameProps) {
  const pool = useMemo(() => coercePlayablePairs(pairs), [pairs]);
  const want = Math.min(pool.length, examMode ? 8 : (maxItems ?? 6));
  const [rounds, setRounds] = useState<TranslateRound[]>(() => buildLocalTranslateRounds(pool, want));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback>('idle');
  const [lastXp, setLastXp] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    startedRef.current = false;
    const local = buildLocalTranslateRounds(pool, want);
    setRounds(local);
    void fetchAiTranslateRoundsTimed(pool, want).then((ai) => {
      if (cancelled || startedRef.current) return;
      if (ai && ai.length > 0) setRounds(ai.slice(0, want));
    });
    return () => {
      cancelled = true;
    };
  }, [pool, want]);

  const round = rounds[index];
  const total = Math.max(1, rounds.length);
  const poolPair = round ? pool[round.pairIndex] ?? pool[index] : undefined;

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, total);
  }, [embedded, onStepProgress, index, total]);

  const finish = useCallback(
    (finalScore: number) => onComplete(finalScore, total),
    [onComplete, total],
  );

  const goNext = (nextScore: number) => {
    setPicked([]);
    setFeedback('idle');
    setLastXp(0);
    if (index + 1 >= rounds.length) finish(nextScore);
    else setIndex((i) => i + 1);
  };

  const slots = round?.expected.length ?? 0;
  const slotsFilled = Boolean(round && picked.length === slots);

  const pickFromBank = (id: string) => {
    if (feedback === 'ok' || feedback === 'fail' || picked.includes(id)) return;
    if (round && picked.length >= round.expected.length) return;
    startedRef.current = true;
    playSound('tap');
    setPicked((ids) => [...ids, id]);
    if (feedback === 'almost') setFeedback('idle');
  };

  const returnTile = (id: string) => {
    if (feedback === 'ok' || feedback === 'fail') return;
    playSound('tap');
    setPicked((ids) => ids.filter((x) => x !== id));
  };

  const check = () => {
    if (!round || !slotsFilled || feedback === 'ok' || feedback === 'fail') return;
    const assembled = picked
      .map((id) => round.bank.find((t) => t.id === id)?.text ?? '')
      .filter(Boolean);
    const grade: TranslateGrade = gradeTranslateAnswer(assembled, round.expected);
    if (grade === 'correct') {
      setFeedback('ok');
      const nextScore = score + 1;
      setScore(nextScore);
      setLastXp(registerAnswer('correct', { pathStep: stepIndex != null }));
      if (poolPair) markCorrected(poolPair);
      window.setTimeout(() => goNext(nextScore), 850);
      return;
    }
    if (grade === 'small') {
      // One tile out of place: let the learner retry, no buzzer, no score change.
      setFeedback('almost');
      playSound('nearMiss');
      return;
    }
    setFeedback('fail');
    registerAnswer('wrong', { pathStep: stepIndex != null });
    if (poolPair) recordMistake(poolPair, 'translate', deckId ?? undefined, stepIndex ?? undefined);
  };

  if (pool.length < 1) {
    onNotEnoughPairs?.();
    return null;
  }

  if (!round) {
    onComplete(0, 1);
    return null;
  }

  const sourceParts = round ? highlightFocusParts(round.source, round.focusWord) : [];

  return (
    <LessonGameShell
      embedded={embedded}
      locale={locale}
      onExit={onExit}
      progress={gameProgressPct(index, total)}
      examMode={examMode}
      className="translate-game"
    >
      <main className="game-main translate-main">
        <span className="translate-badge">{t('translateNewWord', locale)}</span>
        <p className="game-instruction">{t('translateInstruction', locale)}</p>

        <div className="translate-prompt">
          <ScanPlayMascot expression={mascotFor(feedback)} size={88} idle={feedback === 'idle'} />
          <div className="translate-speech">
            {round ? (
              <HearButton
                text={round.source}
                lang={round.termLang}
                locale={locale}
                iconOnly
                className="translate-hear"
              />
            ) : null}
            <div className="translate-bubble">
              {round ? (
                <p className="translate-source">
                  {sourceParts.map((part, i) =>
                    part.hit ? (
                      <strong key={`${part.text}-${i}`} className="translate-focus">
                        {part.text}
                      </strong>
                    ) : (
                      <span key={`${part.text}-${i}`}>{part.text}</span>
                    ),
                  )}
                </p>
              ) : (
                <p className="translate-source">{t('translateLoading', locale)}</p>
              )}
            </div>
          </div>
        </div>

        <div
          className="translate-answer"
          aria-label={t('translateInstruction', locale)}
        >
          {(round?.expected ?? []).map((_, slot) => {
            const id = picked[slot];
            const tile = id ? round.bank.find((t) => t.id === id) : undefined;
            return (
              <button
                key={`slot-${slot}`}
                type="button"
                className={`translate-slot${tile ? ' translate-slot--filled' : ''}`}
                disabled={!tile || feedback === 'ok' || feedback === 'fail'}
                onClick={() => tile && returnTile(tile.id)}
              >
                {tile ? tile.text : '\u00a0'}
              </button>
            );
          })}
        </div>

        <div className="translate-bank">
          {(round?.bank ?? [])
            .filter((tile) => !picked.includes(tile.id))
            .map((tile) => (
              <button
                key={tile.id}
                type="button"
                className="translate-tile"
                disabled={feedback === 'ok' || feedback === 'fail'}
                onClick={() => pickFromBank(tile.id)}
              >
                {tile.text}
              </button>
            ))}
        </div>
      </main>

      <footer className={`translate-footer translate-footer--${feedback}`}>
        {feedback === 'almost' ? (
          <p className="translate-banner-text">{t('translateAlmost', locale)}</p>
        ) : null}
        {feedback === 'fail' ? (
          <div>
            <p className="translate-banner-text">{t('translateFail', locale)}</p>
            <p className="translate-correct">
              {t('translateCorrectShow', locale)} {round?.expected.join(' ')}
            </p>
          </div>
        ) : null}
        {feedback === 'ok' ? (
          <p className="translate-banner-text">
            {t('translateOk', locale)}
            {lastXp > 0 && <span className="answer-feedback-xp">+{lastXp} XP</span>}
          </p>
        ) : null}

        {feedback === 'fail' ? (
          <button type="button" className="btn-primary btn-lg translate-check" onClick={() => goNext(score)}>
            {t('translateContinue', locale)}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary btn-lg translate-check"
            onClick={check}
            disabled={!round || !slotsFilled || feedback === 'ok'}
          >
            {feedback === 'almost' ? t('translateRetry', locale) : t('translateCheck', locale)}
          </button>
        )}
      </footer>
    </LessonGameShell>
  );
}
