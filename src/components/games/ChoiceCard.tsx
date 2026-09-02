import type { CSSProperties, ReactNode } from 'react';

export type ChoiceState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted';

interface ChoiceCardProps {
  children: ReactNode;
  onSelect: () => void;
  state?: ChoiceState;
  disabled?: boolean;
  /** Position in the list — drives the stagger-in animation. */
  index?: number;
  className?: string;
  ariaLabel?: string;
}

/** The answer tile shared by every multiple-choice game. */
export function ChoiceCard({
  children,
  onSelect,
  state = 'idle',
  disabled = false,
  index = 0,
  className = '',
  ariaLabel,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      className={`choice-card choice-card--${state}${className ? ` ${className}` : ''}`}
      style={{ '--stagger': index } as CSSProperties}
      onClick={onSelect}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={state === 'selected' ? true : undefined}
    >
      <span className="choice-card-text">{children}</span>
      {(state === 'correct' || state === 'wrong') && (
        <span className="choice-card-mark" aria-hidden="true">
          {state === 'correct' ? '✓' : '✕'}
        </span>
      )}
    </button>
  );
}
