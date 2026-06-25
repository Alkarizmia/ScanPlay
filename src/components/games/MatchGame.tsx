import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HearButton } from '../HearButton';
import { playGameCorrectSound, playSound } from '../../lib/sounds';
import { getExamTimerSeconds } from '../../lib/examTimer';
import { vibrateError, vibrateSuccess } from '../../lib/haptics';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { resolveSpeakLang } from '../../lib/speakLang';
import type { Locale, WordPair } from '../../types';
import { gameProgressPct, GameHeader } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { GameSkipFooter } from './GameSkipFooter';

interface MatchGameProps extends EmbeddedGameProps {
  pairs: WordPair[];
  locale: Locale;
  examMode?: boolean;
  deckId?: string | null;
  stepIndex?: number | null;
  onComplete: (score: number, total: number) => void;
  onExit: () => void;
}

type Card = { id: string; text: string; pairId: number; kind: 'term' | 'def'; lang?: WordPair['termLang'] };

function buildDeck(pairs: WordPair[]): Card[] {
  const slice = pairs.slice(0, Math.min(6, pairs.length));
  const cards: Card[] = [];
  slice.forEach((p, i) => {
    cards.push({ id: `t-${i}`, text: p.term, pairId: i, kind: 'term', lang: resolveSpeakLang(p) });
    cards.push({ id: `d-${i}`, text: p.definition, pairId: i, kind: 'def', lang: p.defLang });
  });
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function MatchGame({ pairs, locale, examMode, deckId, stepIndex, onComplete, onExit, embedded = false, onStepProgress }: MatchGameProps) {
  const deck = useMemo(() => buildDeck(pairs), [pairs]);
  const pairById = useMemo(() => pairs.slice(0, Math.min(6, pairs.length)), [pairs]);
  const totalPairs = deck.length / 2;
  const maxMoves = examMode ? totalPairs + 2 : totalPairs * 3;
  const timerSeconds = examMode ? getExamTimerSeconds('match', totalPairs) : 0;
  const [selected, setSelected] = useState<Card | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const matchedRef = useRef(matched);
  const finishingRef = useRef(false);
  matchedRef.current = matched;

  const complete = useCallback(
    (score: number) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      onComplete(score, totalPairs);
    },
    [onComplete, totalPairs],
  );

  const skip = useCallback(() => {
    complete(matchedRef.current.size);
  }, [complete]);

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(matched.size, totalPairs);
  }, [embedded, onStepProgress, matched.size, totalPairs]);

  useEffect(() => {
    if (!examMode || timerSeconds <= 0) return;
    setTimeLeft(timerSeconds);
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          const extra = Math.max(0, moves - totalPairs);
          complete(Math.max(0, matchedRef.current.size - Math.floor(extra / 2)));
          return 0;
        }
        if (t <= 11) playSound('examTick');
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [examMode, timerSeconds, totalPairs, moves, complete]);

  const finish = useCallback(() => {
    const extraMoves = Math.max(0, moves - totalPairs);
    const score = Math.max(1, totalPairs - Math.floor(extraMoves / 2));
    complete(score);
  }, [moves, complete, totalPairs]);

  const tap = (card: Card) => {
    if (matched.has(card.pairId)) return;
    if (selected?.id === card.id) {
      setSelected(null);
      return;
    }

    if (!selected) {
      setSelected(card);
      return;
    }

    setMoves((m) => {
      const next = m + 1;
      if (examMode && next >= maxMoves && matched.size < totalPairs) {
        setTimeout(finish, 300);
      }
      return next;
    });

    if (selected.pairId === card.pairId && selected.kind !== card.kind) {
      vibrateSuccess();
      playSound('matchSnap');
      playGameCorrectSound(stepIndex != null);
      markCorrected(pairById[card.pairId]);
      const next = new Set(matched);
      next.add(card.pairId);
      setMatched(next);
      setSelected(null);
      setWrong(new Set());
      if (next.size >= totalPairs) {
        setTimeout(finish, 400);
      }
    } else {
      vibrateError();
      playSound('wrong');
      const wrongPair = pairById[selected.pairId];
      if (wrongPair) {
        recordMistake(wrongPair, 'match', deckId ?? undefined, stepIndex ?? undefined);
      }
      setWrong(new Set([selected.id, card.id]));
      setTimeout(() => {
        setSelected(null);
        setWrong(new Set());
      }, 500);
    }
  };

  const grid = (
    <div className="game-body match-body">
      <div className="match-grid">
        {deck.map((card) => {
          const isMatched = matched.has(card.pairId);
          const isSelected = selected?.id === card.id;
          const isWrong = wrong.has(card.id);
          let cls = 'match-card-wrap';
          if (isMatched) cls += ' matched';
          if (isSelected) cls += ' selected';
          if (isWrong) cls += ' wrong';
          return (
            <div key={card.id} className={`match-card-wrap ${cls}`}>
              <button
                type="button"
                className="match-card"
                onClick={() => tap(card)}
                disabled={isMatched}
                aria-label={card.text}
              >
                <span>{card.text}</span>
              </button>
              {isSelected && (
                <HearButton
                  text={card.text}
                  lang={card.lang}
                  locale={locale}
                  className="match-card-hear"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="lesson-embedded-pane lesson-embedded-pane--with-skip">
        {grid}
        <GameSkipFooter locale={locale} onSkip={skip} />
      </div>
    );
  }

  return (
    <div className="screen game-screen flow-screen">
      <GameHeader
        locale={locale}
        onExit={onExit}
        progress={gameProgressPct(matched.size, totalPairs)}
        examMode={examMode}
        timeLeft={timeLeft}
      />
      {grid}
    </div>
  );
}
