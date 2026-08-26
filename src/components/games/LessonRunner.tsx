import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameMode, Locale, SheetType, WordPair } from '../../types';
import { getLessonTotalUnits, getLessonUnitOffsets, getGameUnitCount } from '../../lib/lessonUnits';
import { gameProgressPct, GameHeader } from './GameHeader';
import { FlashcardsGame } from './FlashcardsGame';
import { TrueFalseGame } from './TrueFalseGame';
import { MatchGame } from './MatchGame';
import { QuizGame } from './QuizGame';
import { TypeGame } from './TypeGame';
import { ListenGame } from './ListenGame';
import { SpeakGame } from './SpeakGame';
import { ClozeGame } from './ClozeGame';
import { TranslateGame } from './TranslateGame';

interface LessonRunnerProps {
  pairs: WordPair[];
  locale: Locale;
  games: GameMode[];
  stepIndex: number;
  deckId?: string | null;
  sheetType?: SheetType;
  startGameIndex?: number;
  pairShift?: number;
  onExit: () => void;
  onPause?: (gameIndex: number, pendingMs: number) => void;
  onSubGameComplete: (mode: GameMode, score: number, total: number, continues: boolean) => void;
  onSubGameStart: () => void;
  onNotEnoughPairs?: () => void;
  onToast?: (message: string) => void;
}

export function LessonRunner({
  pairs,
  locale,
  games,
  stepIndex,
  deckId,
  sheetType,
  startGameIndex = 0,
  pairShift = 0,
  onExit,
  onPause,
  onSubGameComplete,
  onSubGameStart,
  onNotEnoughPairs,
  onToast,
}: LessonRunnerProps) {
  const safeStart = Math.min(Math.max(0, startGameIndex), Math.max(0, games.length - 1));
  const [gameIndex, setGameIndex] = useState(safeStart);
  const [stepDone, setStepDone] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const segmentStart = useRef(Date.now());

  const currentMode = games[gameIndex] ?? games[0]!;
  const itemCap = currentMode === 'match' ? 3 : 2;
  const playPairs = useMemo(() => {
    if (pairs.length <= 1) return pairs;
    const offset = (gameIndex * 2 + pairShift) % pairs.length;
    return [...pairs.slice(offset), ...pairs.slice(0, offset)];
  }, [pairs, gameIndex, pairShift]);
  const unitOffsets = useMemo(() => getLessonUnitOffsets(games, pairs, false), [games, pairs]);
  const totalUnits = useMemo(() => getLessonTotalUnits(games, pairs, false), [games, pairs]);
  const overallProgress = gameProgressPct((unitOffsets[gameIndex] ?? 0) + stepDone, totalUnits);

  const handleStepProgress = useCallback((done: number, total: number) => {
    setStepDone((prev) => Math.max(prev, done));
    void total;
  }, []);

  const onSubGameStartRef = useRef(onSubGameStart);
  onSubGameStartRef.current = onSubGameStart;
  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;
  const gameIndexRef = useRef(gameIndex);
  gameIndexRef.current = gameIndex;

  useEffect(() => {
    onSubGameStartRef.current();
    setStepDone(0);
    segmentStart.current = Date.now();
  }, [gameIndex]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      onPauseRef.current?.(gameIndexRef.current, Date.now() - segmentStart.current);
      segmentStart.current = Date.now();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const handleComplete = useCallback(
    (score: number, total: number) => {
      const continues = gameIndex < games.length - 1;
      setStepDone(getGameUnitCount(currentMode, pairs, false));
      onSubGameComplete(currentMode, score, total, continues);
      if (continues) {
        setTransitioning(true);
        window.setTimeout(() => {
          setGameIndex((i) => i + 1);
          setTransitioning(false);
        }, 280);
      }
    },
    [currentMode, gameIndex, games.length, onSubGameComplete, pairs],
  );

  const handleExit = () => {
    onPauseRef.current?.(gameIndex, Date.now() - segmentStart.current);
    onExit();
  };

  const shared = {
    pairs: playPairs,
    locale,
    examMode: false as const,
    deckId,
    stepIndex,
    embedded: true,
    maxItems: itemCap,
    onStepProgress: handleStepProgress,
    onComplete: handleComplete,
    onExit: handleExit,
  };

  const renderGame = () => {
    switch (currentMode) {
      case 'flashcards':
        return <FlashcardsGame {...shared} />;
      case 'truefalse':
        return <TrueFalseGame {...shared} onNotEnoughPairs={onNotEnoughPairs} />;
      case 'match':
        return <MatchGame {...shared} />;
      case 'quiz':
        return <QuizGame {...shared} onNotEnoughPairs={onNotEnoughPairs} />;
      case 'type':
        return <TypeGame {...shared} sheetType={sheetType} onToast={onToast} />;
      case 'listen':
        return <ListenGame {...shared} onNotEnoughPairs={onNotEnoughPairs} />;
      case 'speak':
        return <SpeakGame {...shared} />;
      case 'cloze':
        return <ClozeGame {...shared} onNotEnoughPairs={onNotEnoughPairs} />;
      case 'translate':
        return <TranslateGame {...shared} onNotEnoughPairs={onNotEnoughPairs} />;
      default:
        return null;
    }
  };

  return (
    <div className="screen lesson-runner flow-screen">
      <GameHeader locale={locale} onExit={handleExit} progress={overallProgress} />
      <div
        className={`lesson-runner-body${transitioning ? ' lesson-runner-body--transition' : ''}`}
        key={`${gameIndex}-${currentMode}`}
      >
        {renderGame()}
      </div>
    </div>
  );
}
