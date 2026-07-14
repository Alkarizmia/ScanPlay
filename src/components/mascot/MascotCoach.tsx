import { ScanPlayMascot } from './ScanPlayMascot';
import type { MascotExpression } from '../../lib/mascot/types';
import { getLevel, getGamification } from '../../lib/gamification';

export interface MascotCoachProps {
  message?: string;
  expression?: MascotExpression | string;
  size?: number;
  idle?: boolean;
  celebrate?: boolean;
  level?: number;
  placement?: 'inline' | 'card' | 'compact' | 'bubble-above';
  className?: string;
  bubble?: boolean;
}

export function MascotCoach({
  message,
  expression = 'happy',
  size = 72,
  idle = true,
  celebrate = false,
  level,
  placement = 'inline',
  className = '',
  bubble = true,
}: MascotCoachProps) {
  const xp = getGamification().xp;
  const resolvedLevel = level ?? getLevel(xp);

  const bubbleAbove = placement === 'bubble-above';

  return (
    <div className={`mascot-coach mascot-coach--${placement} ${className}`.trim()}>
      {bubble && message && bubbleAbove ? (
        <div className="mascot-coach-bubble mascot-coach-bubble--above" role="status">
          <p className="mascot-coach-message">{message}</p>
        </div>
      ) : null}
      <ScanPlayMascot
        expression={expression}
        size={size}
        idle={idle}
        celebrate={celebrate}
        level={resolvedLevel}
      />
      {bubble && message && !bubbleAbove ? (
        <div className="mascot-coach-bubble" role="status">
          <p className="mascot-coach-message">{message}</p>
        </div>
      ) : null}
    </div>
  );
}
