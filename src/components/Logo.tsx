import { useRef } from 'react';
import { playSound } from '../lib/sounds';

/** Logo officiel ScanPlay — généré depuis public/brand/scanplay-logo.png au build. */
const LOGO_SRC = '/logo.png?v=7';

export function Logo({
  size = 48,
  variant = 'default',
}: {
  size?: number;
  variant?: 'default' | 'sidebar';
}) {
  return (
    <img
      src={LOGO_SRC}
      alt=""
      height={size}
      {...(variant === 'sidebar' ? { width: size } : {})}
      className="scanplay-logo"
      aria-hidden="true"
      draggable={false}
    />
  );
}

export function LogoWordmark({ variant = 'default' }: { variant?: 'default' | 'sidebar' }) {
  const tapsRef = useRef(0);
  const lastTapRef = useRef(0);
  const logoSize = variant === 'sidebar' ? 36 : 40;

  const handleEasterEgg = () => {
    const now = Date.now();
    if (now - lastTapRef.current > 2500) tapsRef.current = 0;
    lastTapRef.current = now;
    tapsRef.current += 1;
    if (tapsRef.current >= 7) {
      tapsRef.current = 0;
      playSound('easterEgg');
    }
  };

  return (
    <div
      className={`wordmark wordmark--${variant}`}
      onClick={handleEasterEgg}
      role="presentation"
    >
      <Logo size={logoSize} variant={variant} />
      <span className="wordmark-text">
        Scan<span className="wordmark-accent">Play</span>
      </span>
    </div>
  );
}
