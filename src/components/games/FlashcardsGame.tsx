import { useCallback, useEffect, useRef, useState } from 'react';
import { HearButton } from '../HearButton';
import { playSound } from '../../lib/sounds';
import { getExamTimerSeconds } from '../../lib/examTimer';
import { addCorrectAnswer } from '../../lib/gamification';
import { vibrateSuccess } from '../../lib/haptics';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { resolveSpeakLang } from '../../lib/speakLang';
import { dispatchMascotReaction } from '../../lib/mascot/reactions';
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
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null);

  const total = Math.min(pairs.length, examMode ? 10 : (maxItems ?? 8));
  const deck = pairs.slice(0, total);
  const current = deck[index];
  const timerSeconds = examMode ? getExamTimerSeconds('flashcards', total) : 0;
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const knownRef = useRef(0);
  knownRef.current = known;
  const pointerStart = useRef<{ x: number; id: number } | null>(null);
  const movedRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index + 1, total);
  }, [embedded, onStepProgress, index, total]);

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
        addCorrectAnswer();
        markCorrected(current);
        vibrateSuccess();
        playSound('correct');
        dispatchMascotReaction({
          type: 'correct',
          messageKey: knownRef.current % 2 === 0 ? 'mascotFlashSuper' : 'mascotFlashNice',
        });
      } else {
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
        setFlipped(false);
        setDragX(0);
        setLeaving(null);
        busyRef.current = false;
      }, 180);
    },
    [current, deckId, finish, index, known, stepIndex, total],
  );

  const commitSwipe = (gotIt: boolean) => {
    setLeaving(gotIt ? 'right' : 'left');
    setDragX(gotIt ? 280 : -280);
    answer(gotIt);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (busyRef.current) return;
    if ((e.target as HTMLElement).closest('button')) return;
    pointerStart.current = { x: e.clientX, id: e.pointerId };
    movedRef.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointerStart.current || pointerStart.current.id !== e.pointerId) return;
    const dx = e.clientX - pointerStart.current.x;
    if (Math.abs(dx) > 8) movedRef.current = true;
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
  };

  const onCardActivate = () => {
    if (movedRef.current || busyRef.current) return;
    setFlipped((f) => {
      if (!f) playSound('reveal');
      return !f;
    });
  };

  if (!current) return null;

  const frontLabel =
    current.termLang &&
    current.defLang &&
    current.termLang !== 'unknown' &&
    current.defLang !== 'unknown'
      ? `${current.termLang.toUpperCase()} → ${current.defLang.toUpperCase()}`
      : t('cardTermLabel', locale);
  const backLabel =
    current.termLang &&
    current.defLang &&
    current.termLang !== 'unknown' &&
    current.defLang !== 'unknown'
      ? `${current.defLang.toUpperCase()}`
      : t('cardMeaningLabel', locale);

  const knownHint = Math.min(1, Math.max(0, dragX / SWIPE_COMMIT));
  const reviewHint = Math.min(1, Math.max(0, -dragX / SWIPE_COMMIT));
  const tilt = Math.max(-12, Math.min(12, dragX / 18));

  const body = (
    <>
      <div className="game-body flashcards-body">
        <div
          className={`flashcard-swipe-stage${leaving ? ` flashcard-swipe-stage--leave-${leaving}` : ''}`}
          style={{
            transform: `translateX(${dragX}px) rotate(${tilt}deg)`,
            transition: pointerStart.current ? 'none' : 'transform 0.2s ease',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
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
            className={`flashcard ${flipped ? 'flipped' : ''}`}
            onClick={onCardActivate}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCardActivate();
              }
              if (e.key === 'ArrowRight') commitSwipe(true);
              if (e.key === 'ArrowLeft') commitSwipe(false);
            }}
          >
            <div className="flashcard-face front">
              <span className="card-label">{frontLabel}</span>
              <FormulaText as="p" className="card-text" text={current.term} />
              <HearButton
                text={current.term}
                lang={resolveSpeakLang(current)}
                locale={locale}
                className="flashcard-hear"
                iconOnly
              />
              <span className="card-hint">{t('cardTapToFlip', locale)}</span>
            </div>
            <div className="flashcard-face back">
              <span className="card-label">{backLabel}</span>
              <FormulaText as="p" className="card-text" text={current.definition} />
              <HearButton
                text={current.definition}
                lang={current.defLang}
                locale={locale}
                className="flashcard-hear"
                iconOnly
              />
            </div>
          </div>
        </div>
      </div>

      {flipped && (
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
