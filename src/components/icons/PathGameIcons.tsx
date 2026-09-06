import type { ReactNode } from 'react';
import type { GameMode } from '../../types';

export type PathGameKind = 'listen' | 'write' | 'quiz';

interface IconProps {
  size?: number;
  className?: string;
}

function StrokeIcon({ size = 28, className = '', children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ListenIcon({ size, className }: IconProps) {
  return (
    <StrokeIcon size={size} className={className}>
      <path
        d="M4.5 13.5v-1a7.5 7.5 0 0 1 15 0v1"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <rect x="3" y="13" width="4.5" height="7" rx="1.6" stroke="currentColor" strokeWidth="2.2" />
      <rect x="16.5" y="13" width="4.5" height="7" rx="1.6" stroke="currentColor" strokeWidth="2.2" />
    </StrokeIcon>
  );
}

export function WriteIcon({ size, className }: IconProps) {
  return (
    <StrokeIcon size={size} className={className}>
      <path
        d="M13.2 5.4 18.6 10.8 8.2 21.2 3.5 21.5 3.8 16.8Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M11.8 6.8 17.2 12.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </StrokeIcon>
  );
}

export function QuizIcon({ size, className }: IconProps) {
  return (
    <StrokeIcon size={size} className={className}>
      <path
        d="M5 5.5h14v11.5H9.2L5 20.5V5.5Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M10 10.2c0-1.15.95-2 2-2s2 .85 2 2c0 .95-.9 1.45-2 2.05V13"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15.4" r="0.9" fill="currentColor" />
    </StrokeIcon>
  );
}

const LISTEN: GameMode[] = ['listen', 'speak', 'listenpick', 'dictation'];
const WRITE: GameMode[] = ['type', 'cloze', 'translate', 'reorder'];

export function pathGameKind(mode: GameMode): PathGameKind {
  if (LISTEN.includes(mode)) return 'listen';
  if (WRITE.includes(mode)) return 'write';
  return 'quiz';
}

export function PathGameKindIcon({
  kind,
  size = 28,
  className = 'path-game-kind-icon',
}: {
  kind: PathGameKind;
  size?: number;
  className?: string;
}) {
  if (kind === 'listen') return <ListenIcon size={size} className={className} />;
  if (kind === 'write') return <WriteIcon size={size} className={className} />;
  return <QuizIcon size={size} className={className} />;
}
