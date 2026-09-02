import type { ReactNode } from 'react';
import type { Locale } from '../../types';
import { GameHeader } from './GameHeader';

interface LessonGameShellProps {
  embedded?: boolean;
  locale: Locale;
  onExit: () => void;
  progress: number;
  examMode?: boolean;
  timeLeft?: number;
  className?: string;
  /** Shared answer banner, pinned under the game body. */
  feedback?: ReactNode;
  children: ReactNode;
}

/** Enveloppe : barre locale ou intégrée dans une leçon unifiée. */
export function LessonGameShell({
  embedded,
  locale,
  onExit,
  progress,
  examMode,
  timeLeft,
  className = '',
  feedback,
  children,
}: LessonGameShellProps) {
  if (embedded) {
    return (
      <div className={`lesson-embedded-pane${className ? ` ${className}` : ''}`}>
        {children}
        {feedback}
      </div>
    );
  }

  return (
    <div className={`screen game-screen flow-screen${className ? ` ${className}` : ''}`}>
      <GameHeader
        locale={locale}
        onExit={onExit}
        progress={progress}
        examMode={examMode}
        timeLeft={timeLeft}
      />
      {children}
      {feedback}
    </div>
  );
}
