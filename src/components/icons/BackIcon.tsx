interface BackIconProps {
  size?: number;
  className?: string;
}

/** Chevron retour ScanPlay — trait arrondi, lisible dans les icon-btn. */
export function BackIcon({ size = 22, className = 'back-icon' }: BackIconProps) {
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
        d="M14.5 5.25 7.25 12l7.25 6.75"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
