import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameMode, Locale, WordPair } from '../../types';
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
import type { SheetType } from '../../types';

interface LessonRunnerProps {
  pairs: WordPair[];
  locale: Locale;
  games: GameMode[];
  stepIndex: number;
  deckId?: string | null;
  sheetType?: SheetType;
  onExit: () => void;
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
  onExit,
  onSubGameComplete,
  onSubGameStart,
  onNotEnoughPairs,
  onToast,
}: LessonRunnerProps) {
  const [gameIndex, setGameIndex] = useState(0);
  const [stepDone, setStepDone] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const currentMode = games[gameIndex] ?? games[0]!;
  const unitOffsets = useMemo(() => getLessonUnitOffsets(games, pairs, false), [games, pairs]);
  const totalUnits = useMemo(() => getLessonTotalUnits(games, pairs, false), [games, pairs]);
  const overallProgress = gameProgressPct((unitOffsets[gameIndex] ?? 0) + stepDone, totalUnits);

  const handleStepProgress = useCallback((done: number, total: number) => {
    setStepDone(done);
    void total;
  }, []);

  useEffect(() => {
    onSubGameStart();
    setStepDone(0);
  }, [gameIndex, onSubGameStart]);

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
    [currentMode, gameIndex, games.length, onSubGameComplete],
  );

  const shared = {
    pairs,
    locale,
    examMode: false as const,
    deckId,
    stepIndex,
    embedded: true,
    onStepProgress: handleStepProgress,
    onComplete: handleComplete,
    onExit,
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
      default:
        return null;
    }
  };

  return (
    <div className="screen lesson-runner flow-screen">
      <GameHeader locale={locale} onExit={onExit} progress={overallProgress} />
      <div
        className={`lesson-runner-body${transitioning ? ' lesson-runner-body--transition' : ''}`}
        key={`${gameIndex}-${currentMode}`}
      >
        {renderGame()}
      </div>
    </div>
  );
}
