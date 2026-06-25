import { useCallback, useEffect, useRef, useState } from 'react';
import { HearButton } from '../HearButton';
import { playGameCorrectSound, playSound } from '../../lib/sounds';
import { getExamTimerSeconds } from '../../lib/examTimer';
import { addCorrectAnswer } from '../../lib/gamification';
import { vibrateSuccess } from '../../lib/haptics';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { resolveSpeakLang } from '../../lib/speakLang';
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

export function FlashcardsGame({
  pairs,
  locale,
  examMode,
  deckId,
  stepIndex,
  onComplete,
  onExit,
  embedded = false,
  onStepProgress,
}: FlashcardsGameProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);

  const total = Math.min(pairs.length, examMode ? 10 : 8);
  const deck = pairs.slice(0, total);
  const current = deck[index];
  const timerSeconds = examMode ? getExamTimerSeconds('flashcards', total) : 0;
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const knownRef = useRef(0);
  knownRef.current = known;

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, total);
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

  const answer = (gotIt: boolean) => {
    if (!current) return;
    if (gotIt) {
      addCorrectAnswer();
      markCorrected(current);
      vibrateSuccess();
      playGameCorrectSound(stepIndex != null);
    } else {
      recordMistake(current, 'flashcards', deckId ?? undefined, stepIndex ?? undefined);
      playSound('wrong');
    }
    const nextKnown = known + (gotIt ? 1 : 0);
    if (index >= total - 1) {
      finish(nextKnown);
      return;
    }
    setKnown(nextKnown);
    setIndex((i) => i + 1);
    setFlipped(false);
  };

  if (!current) return null;

  const body = (
    <>
      <div className="game-body flashcards-body">
        <div
          role="button"
          tabIndex={0}
          className={`flashcard ${flipped ? 'flipped' : ''}`}
          onClick={() =>
            setFlipped((f) => {
              if (!f) playSound('cardFlip');
              return !f;
            })
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFlipped((f) => {
                if (!f) playSound('cardFlip');
                return !f;
              });
            }
          }}
        >
          <div className="flashcard-face front">
            <span className="card-label">Term</span>
            <p className="card-text">{current.term}</p>
            <HearButton
              text={current.term}
              lang={resolveSpeakLang(current)}
              locale={locale}
              className="flashcard-hear"
              iconOnly
            />
            <span className="card-hint">Tap to flip</span>
          </div>
          <div className="flashcard-face back">
            <span className="card-label">Meaning</span>
            <p className="card-text">{current.definition}</p>
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

      {flipped && (
        <div className="game-actions">
          <button type="button" className="btn-secondary" onClick={() => answer(false)}>
            Still learning
          </button>
          <button type="button" className="btn-primary" onClick={() => answer(true)}>
            Got it!
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
