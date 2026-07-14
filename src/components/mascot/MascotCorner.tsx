import { useCallback, useEffect, useRef, useState } from 'react';

import { ScanPlayMascot } from './ScanPlayMascot';
import { MASCOT_EVENT, reactionToExpression } from '../../lib/mascot/reactions';
import type { MascotExpression, MascotReactionEvent } from '../../lib/mascot/types';
import { getLevel, getGamification } from '../../lib/gamification';
import { t } from '../../lib/i18n';
import type { Locale } from '../../types';

interface MascotCornerProps {
  locale: Locale;
  enabled?: boolean;
}

const DISMISS_MS = 2400;

export function MascotCorner({ locale, enabled = true }: MascotCornerProps) {
  const [visible, setVisible] = useState(false);
  const [expression, setExpression] = useState<MascotExpression>('happy');
  const [message, setMessage] = useState('');
  const timerRef = useRef<number | null>(null);
  const level = getLevel(getGamification().xp);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const show = useCallback(
    (expr: MascotExpression, msg: string) => {
      if (!enabled) return;
      setExpression(expr);
      setMessage(msg);
      setVisible(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(dismiss, DISMISS_MS);
    },
    [dismiss, enabled],
  );

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
      show(expr, msg);
    };

    window.addEventListener(MASCOT_EVENT, onReaction);
    return () => {
      window.removeEventListener(MASCOT_EVENT, onReaction);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [enabled, locale, show]);

  if (!visible) return null;

  return (
    <div className="mascot-corner" aria-live="polite">
      <div className="mascot-corner-bubble">
        <p>{message}</p>
      </div>
      <ScanPlayMascot expression={expression} size={64} idle celebrate level={level} />
    </div>
  );
}
