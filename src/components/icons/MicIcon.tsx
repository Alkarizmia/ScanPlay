interface MicIconProps {
  size?: number;
  className?: string;
}

/** Micro vectoriel ScanPlay — même trait arrondi que LockIcon / BackIcon. */
export function MicIcon({ size = 24, className = 'mic-icon' }: MicIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="8.4"
        y="3.2"
        width="7.2"
        height="11.2"
        rx="3.6"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path
        d="M6.2 11.4a5.8 5.8 0 0 0 11.6 0"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M12 17.2V20.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8.4 20.4h7.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
