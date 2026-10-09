interface ChatArrowIconProps {
  direction: 'up' | 'down';
  size?: number;
  className?: string;
}

/** Flèche coach (envoyer / redescendre) — même trait arrondi ScanPlay que Mic/Back. */
export function ChatArrowIcon({ direction, size = 20, className = 'chat-arrow-icon' }: ChatArrowIconProps) {
  const isUp = direction === 'up';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={isUp ? 'M12 19.2V6.4' : 'M12 4.8V17.6'}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d={isUp ? 'M6.6 11.2 12 5.6l5.4 5.6' : 'M6.6 12.8 12 18.4l5.4-5.6'}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
