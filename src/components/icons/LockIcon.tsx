interface LockIconProps {
  size?: number;
  className?: string;
}

/** Cadenas vectoriel ScanPlay — même trait arrondi que BackIcon. */
export function LockIcon({ size = 22, className = 'lock-icon' }: LockIconProps) {
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
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path
        d="M8 11V8.2a4 4 0 0 1 8 0V11"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
