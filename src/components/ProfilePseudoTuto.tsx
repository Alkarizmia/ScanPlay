import { useEffect, useRef, useState } from 'react';

import { MascotCoach } from './mascot/MascotCoach';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface ProfilePseudoTutoProps {
  locale: Locale;
  nameField: HTMLElement | null;
  zooming: boolean;
  onSkip: () => void;
}

export function ProfilePseudoTuto({ locale, nameField, zooming, onSkip }: ProfilePseudoTutoProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [docked, setDocked] = useState(false);
  const [coords, setCoords] = useState<{ top?: number; left?: number }>({});

  useEffect(() => {
    if (!nameField) return;

    const update = () => {
      const rect = nameField.getBoundingClientRect();
      const column = (nameField.closest('.profile-card') ?? nameField).getBoundingClientRect();
      const header = 64;
      const footer = 88;
      const boxH = boxRef.current?.offsetHeight ?? 180;
      const boxW = Math.min(280, Math.max(200, column.width - 16));
      const left = Math.max(column.left + 8, column.right - boxW - 8);
      const visible = rect.top < window.innerHeight - footer && rect.bottom > header + 24;
      setDocked(visible);
      if (visible) {
        setCoords({ top: Math.max(header + 8, rect.top - boxH - 10), left });
      } else {
        setCoords({ left });
      }
    };

    update();
    const scrollRoot = nameField.closest('.profile-main');
    scrollRoot?.addEventListener('scroll', update, { passive: true });
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const io = new IntersectionObserver(update, { threshold: [0, 0.25, 0.6, 1] });
    io.observe(nameField);

    return () => {
      scrollRoot?.removeEventListener('scroll', update);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      io.disconnect();
    };
  }, [nameField]);

  const style =
    coords.left != null
      ? docked && coords.top != null
        ? { top: coords.top, left: coords.left, right: 'auto', bottom: 'auto' as const }
        : { left: coords.left, right: 'auto' }
      : undefined;

  return (
    <div
      ref={boxRef}
      className={`profile-pseudo-tuto${docked ? ' profile-pseudo-tuto--docked' : ''}${zooming ? ' profile-pseudo-tuto--zoom' : ''}`}
      style={style}
      role="dialog"
      aria-labelledby="profile-pseudo-title"
    >
      <button type="button" className="profile-pseudo-skip" onClick={onSkip}>
        {t('mascotPseudoSkip', locale)}
      </button>
      <MascotCoach
        expression="welcome"
        size={docked ? 72 : 84}
        idle
        celebrate={docked}
        placement="bubble-above"
        message={t('mascotPseudoMessage', locale)}
      />
      <p id="profile-pseudo-title" className="profile-pseudo-title">
        {t('mascotPseudoTitle', locale)}
      </p>
    </div>
  );
}
