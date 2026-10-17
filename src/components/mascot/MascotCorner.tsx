import { useCallback, useEffect, useRef, useState } from 'react';

import { ScanPlayMascot } from './ScanPlayMascot';
import { MASCOT_EVENT, reactionToExpression } from '../../lib/mascot/reactions';
import type { MascotExpression, MascotReactionEvent, MascotReactionType } from '../../lib/mascot/types';
import { getLevel, getGamification } from '../../lib/gamification';
import { t } from '../../lib/i18n';
import type { Locale } from '../../types';

interface MascotCornerProps {
  locale: Locale;
  enabled?: boolean;
}

const DISMISS_DEFAULT_MS = 2400;
const DISMISS_STREAK_MS = 3200;
const DISMISS_BIG_MS = 2800;
const EXIT_MS = 150;

function dismissMsFor(type: MascotReactionType): number {
  if (type === 'streak') return DISMISS_STREAK_MS;
  if (type === 'levelup' || type === 'chest' || type === 'badge' || type === 'combo5') return DISMISS_BIG_MS;
  return DISMISS_DEFAULT_MS;
}

export function MascotCorner({ locale, enabled = true }: MascotCornerProps) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [expression, setExpression] = useState<MascotExpression>('happy');
  const [reactionType, setReactionType] = useState<MascotReactionType | null>(null);
  const [message, setMessage] = useState('');
  const [burstKey, setBurstKey] = useState(0);
  const dismissTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const level = getLevel(getGamification().xp);

  const clearTimers = useCallback(() => {
    if (dismissTimerRef.current != null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (exitTimerRef.current != null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const finishHide = useCallback(() => {
    setVisible(false);
    setLeaving(false);
    exitTimerRef.current = null;
  }, []);

  const beginExit = useCallback(() => {
    setLeaving(true);
    if (exitTimerRef.current != null) window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = window.setTimeout(finishHide, EXIT_MS);
  }, [finishHide]);

  const show = useCallback(
    (expr: MascotExpression, msg: string, type: MascotReactionType) => {
      if (!enabled) return;
      clearTimers();
      setLeaving(false);
      setExpression(expr);
      setReactionType(type);
      setMessage(msg);
      setBurstKey((k) => k + 1);
      setVisible(true);
      dismissTimerRef.current = window.setTimeout(beginExit, dismissMsFor(type));
    },
    [beginExit, clearTimers, enabled],
  );

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      setVisible(false);
      setLeaving(false);
    }
  }, [clearTimers, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const onReaction = (e: Event) => {
      const detail = (e as CustomEvent<MascotReactionEvent>).detail;
      if (!detail) return;
      const expr = reactionToExpression(detail.type);
      let msg = detail.messageKey ? t(detail.messageKey as Parameters<typeof t>[0], locale) : '';
      if (detail.type === 'streak' && detail.streak != null) {
        msg = t('mascotStreakDays', locale).replace('{days}', String(detail.streak));
      }
      show(expr, msg, detail.type);
    };

    window.addEventListener(MASCOT_EVENT, onReaction);
    return () => {
      window.removeEventListener(MASCOT_EVENT, onReaction);
    };
  }, [enabled, locale, show]);

  useEffect(
    () => () => {
      clearTimers();
    },
    [clearTimers],
  );

  if (!enabled || !visible) return null;

  return (
    <div
      className={[
        'mascot-corner',
        leaving ? 'mascot-corner--out' : 'mascot-corner--in',
        reactionType ? `mascot-corner--${reactionType}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-live="polite"
    >
      <div className="mascot-corner-bubble">
        <p>{message}</p>
      </div>
      <ScanPlayMascot
        key={burstKey}
        expression={expression}
        size={68}
        idle={false}
        celebrate
        level={level}
      />
    </div>
  );
}
