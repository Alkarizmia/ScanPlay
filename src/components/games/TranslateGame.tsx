import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HearButton } from '../HearButton';
import { ScanPlayMascot } from '../mascot/ScanPlayMascot';
import { playGameCorrectSound, playSound } from '../../lib/sounds';
import { vibrateError, vibrateSuccess } from '../../lib/haptics';
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
    if (index + 1 >= rounds.length) finish(nextScore);
    else setIndex((i) => i + 1);
  };

  const pickFromBank = (id: string) => {
    if (feedback === 'ok' || feedback === 'fail' || picked.includes(id)) return;
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
    if (!round || picked.length === 0 || feedback === 'ok' || feedback === 'fail') return;
    const assembled = picked
      .map((id) => round.bank.find((t) => t.id === id)?.text ?? '')
      .filter(Boolean);
    const grade: TranslateGrade = gradeTranslateAnswer(assembled, round.expected);
    if (grade === 'correct') {
      setFeedback('ok');
      const nextScore = score + 1;
      setScore(nextScore);
      playGameCorrectSound(stepIndex != null);
      vibrateSuccess();
      if (poolPair) markCorrected(poolPair);
      window.setTimeout(() => goNext(nextScore), 850);
      return;
    }
    if (grade === 'small') {
      setFeedback('almost');
      playSound('wrong');
      return;
    }
    setFeedback('fail');
    playSound('wrong');
    vibrateError();
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
          <div className="translate-bubble">
            {round ? (
              <>
                <HearButton
                  text={round.source}
                  lang={round.termLang}
                  locale={locale}
                  iconOnly
                  className="translate-hear"
                />
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
              </>
            ) : (
              <p className="translate-source">{t('translateLoading', locale)}</p>
            )}
          </div>
        </div>

        <div className="translate-answer" aria-label={t('translateInstruction', locale)}>
          {picked.length === 0 ? <div className="translate-answer-line" /> : null}
          <div className="translate-answer-tiles">
            {picked.map((id) => {
              const tile = round?.bank.find((t) => t.id === id);
              if (!tile) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className="translate-tile translate-tile--placed"
                  onClick={() => returnTile(id)}
                >
                  {tile.text}
                </button>
              );
            })}
          </div>
          {picked.length > 0 ? <div className="translate-answer-line" /> : null}
        </div>

        <div className="translate-bank">
          {(round?.bank ?? []).map((tile) => {
            const used = picked.includes(tile.id);
            return (
              <button
                key={tile.id}
                type="button"
                className={`translate-tile${used ? ' translate-tile--ghost' : ''}`}
                disabled={used || feedback === 'ok' || feedback === 'fail'}
                onClick={() => pickFromBank(tile.id)}
              >
                {used ? '\u00a0' : tile.text}
              </button>
            );
          })}
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
        {feedback === 'ok' ? <p className="translate-banner-text">{t('translateOk', locale)}</p> : null}

        {feedback === 'fail' ? (
          <button type="button" className="btn-primary btn-lg translate-check" onClick={() => goNext(score)}>
            {t('translateContinue', locale)}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary btn-lg translate-check"
            onClick={check}
            disabled={!round || picked.length === 0 || feedback === 'ok'}
          >
            {feedback === 'almost' ? t('translateRetry', locale) : t('translateCheck', locale)}
          </button>
        )}
      </footer>
    </LessonGameShell>
  );
}
