import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HearButton } from '../HearButton';
import { playSound } from '../../lib/sounds';
import { getExamTimerSeconds } from '../../lib/examTimer';
import { registerAnswer } from '../../lib/gameFeedback';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { resolveSpeakLang } from '../../lib/speakLang';
import { getCardSides } from '../../lib/cardFaces';
import { getLocale, t } from '../../lib/i18n';
import { FormulaText } from '../FormulaText';
import type { Locale, WordPair } from '../../types';
import { gameProgressPct, GameHeader } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';

interface FlashcardsGameProps extends EmbeddedGameProps {
  pairs: WordPair[];
  locale: Locale;
  examMode?: boolean;
  deckId?: string | null;
  stepIndex?: number | null;
  onComplete: (score: number, total: number) => void;
  onExit: () => void;
}

const SWIPE_COMMIT = 72;

export function FlashcardsGame({
  pairs,
  locale: localeProp,
  examMode,
  deckId,
  stepIndex,
  onComplete,
  onExit,
  embedded = false,
  onStepProgress,
  maxItems,
}: FlashcardsGameProps) {
  const locale = getLocale() || localeProp;
  const [index, setIndex] = useState(0);
  const [faceIndex, setFaceIndex] = useState(0);
  const [known, setKnown] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null);

  const total = Math.min(pairs.length, examMode ? 10 : (maxItems ?? 8));
  const deck = pairs.slice(0, total);
  const current = deck[index];
  const sides = useMemo(() => (current ? getCardSides(current) : []), [current]);
  const lastFace = faceIndex >= sides.length - 1;
  const timerSeconds = examMode ? getExamTimerSeconds('flashcards', total) : 0;
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const knownRef = useRef(0);
  knownRef.current = known;
  const pointerStart = useRef<{ x: number; id: number } | null>(null);
  const movedRef = useRef(false);
  const busyRef = useRef(false);
  const lastPointerTypeRef = useRef<string>('touch');

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index + 1, total);
  }, [embedded, onStepProgress, index, total]);

  useEffect(() => {
    setFaceIndex(0);
  }, [index]);

  useEffect(() => {
    if (!examMode || timerSeconds <= 0) return;
    setTimeLeft(timerSeconds);
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          onComplete(knownRef.current, total);
          return 0;
        }
        if (t <= 11) playSound('examTick');
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [examMode, timerSeconds, total, onComplete]);

  const finish = useCallback(
    (finalKnown: number) => onComplete(finalKnown, total),
    [onComplete, total],
  );

  const answer = useCallback(
    (gotIt: boolean) => {
      if (!current || busyRef.current) return;
      busyRef.current = true;
      if (gotIt) {
        registerAnswer('correct', { pathStep: stepIndex != null });
        markCorrected(current);
      } else {
        registerAnswer('wrong', { silent: true });
        playSound('whoosh');
        recordMistake(current, 'flashcards', deckId ?? undefined, stepIndex ?? undefined);
      }
      const nextKnown = known + (gotIt ? 1 : 0);
      if (index >= total - 1) {
        window.setTimeout(() => finish(nextKnown), 180);
        return;
      }
      window.setTimeout(() => {
        setKnown(nextKnown);
        setIndex((i) => i + 1);
        setFaceIndex(0);
        setDragX(0);
        setLeaving(null);
        busyRef.current = false;
      }, 180);
    },
    [current, deckId, finish, index, known, stepIndex, total],
  );

  const commitSwipe = (gotIt: boolean) => {
    if (!lastFace && sides.length > 2) {
      setFaceIndex((i) => Math.min(i + 1, sides.length - 1));
      playSound('reveal');
      return;
    }
    setLeaving(gotIt ? 'right' : 'left');
    setDragX(gotIt ? 280 : -280);
    answer(gotIt);
  };

  const onCardActivate = () => {
    if (movedRef.current || busyRef.current) return;
    if (lastFace) {
      setFaceIndex(0);
      playSound('whoosh');
      return;
    }
    playSound('reveal');
    setFaceIndex((i) => Math.min(i + 1, sides.length - 1));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (busyRef.current) return;
    if ((e.target as HTMLElement).closest('button')) return;
    lastPointerTypeRef.current = e.pointerType;
    pointerStart.current = { x: e.clientX, id: e.pointerId };
    movedRef.current = false;
    if (e.pointerType !== 'mouse') {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointerStart.current || pointerStart.current.id !== e.pointerId) return;
    const dx = e.clientX - pointerStart.current.x;
    const slop = e.pointerType === 'mouse' ? 16 : 8;
    if (Math.abs(dx) > slop) movedRef.current = true;
    if (e.pointerType === 'mouse' && !movedRef.current) return;
    setDragX(dx);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointerStart.current || pointerStart.current.id !== e.pointerId) return;
    const dx = e.clientX - pointerStart.current.x;
    pointerStart.current = null;
    if (dx >= SWIPE_COMMIT) {
      commitSwipe(true);
      return;
    }
    if (dx <= -SWIPE_COMMIT) {
      commitSwipe(false);
      return;
    }
    setDragX(0);
    if (e.pointerType === 'mouse' && !movedRef.current) {
      onCardActivate();
    }
  };

  if (!current || sides.length < 2) return null;

  const shown = sides[faceIndex] ?? current.term;
  const faceLabel =
    sides.length <= 2
      ? faceIndex === 0
        ? t('cardTermLabel', locale)
        : t('cardMeaningLabel', locale)
      : t('cardFaceStep', locale)
          .replace('{i}', String(faceIndex + 1))
          .replace('{n}', String(sides.length));
  const rot = Math.max(-18, Math.min(18, dragX / 12));
  const knownHint = Math.max(0, Math.min(1, dragX / SWIPE_COMMIT));
  const reviewHint = Math.max(0, Math.min(1, -dragX / SWIPE_COMMIT));

  const body = (
    <>
      <div className="game-body flashcards-body">
        <div
          className={`flashcard-stage${leaving ? ` flashcard-stage--leave-${leaving}` : ''}`}
          style={{ transform: `translateX(${dragX}px) rotate(${rot}deg)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            pointerStart.current = null;
            setDragX(0);
          }}
        >
          <span
            className="flashcard-swipe-stamp flashcard-swipe-stamp--known"
            style={{ opacity: knownHint }}
          >
            {t('cardSwipeKnown', locale)}
          </span>
          <span
            className="flashcard-swipe-stamp flashcard-swipe-stamp--review"
            style={{ opacity: reviewHint }}
          >
            {t('cardSwipeReview', locale)}
          </span>
          <div
            role="button"
            tabIndex={0}
            className={`flashcard flashcard--die${lastFace ? ' flashcard--die-last' : ''}`}
            onClick={() => {
              if (lastPointerTypeRef.current === 'mouse') return;
              onCardActivate();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCardActivate();
              }
              if (e.key === 'ArrowRight') commitSwipe(true);
              if (e.key === 'ArrowLeft') commitSwipe(false);
            }}
          >
            <div className="flashcard-face flashcard-face--single">
              <span className="card-label">{faceLabel}</span>
              <FormulaText as="p" className="card-text" text={shown} />
              <HearButton
                text={shown}
                lang={faceIndex === 0 ? resolveSpeakLang(current) : current.defLang}
                locale={locale}
                className="flashcard-hear"
                iconOnly
              />
              <div className="flashcard-die-dots" aria-hidden>
                {sides.map((_, i) => (
                  <span
                    key={`dot-${i}`}
                    className={`flashcard-die-dot${i === faceIndex ? ' flashcard-die-dot--on' : ''}`}
                  />
                ))}
              </div>
              <span className="card-hint">
                {lastFace ? t('cardTapToRestart', locale) : t('cardTapNextFace', locale)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {lastFace && (
        <div className="game-actions">
          <button type="button" className="btn-secondary" onClick={() => commitSwipe(false)}>
            {t('cardStillLearning', locale)}
          </button>
          <button type="button" className="btn-primary" onClick={() => commitSwipe(true)}>
            {t('cardGotIt', locale)}
          </button>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="lesson-embedded-pane">{body}</div>;
  }

  return (
    <div className="screen game-screen flow-screen">
      <GameHeader
        locale={locale}
        onExit={onExit}
        progress={gameProgressPct(index + 1, total)}
        examMode={examMode}
        timeLeft={timeLeft}
      />
      {body}
    </div>
  );
}
