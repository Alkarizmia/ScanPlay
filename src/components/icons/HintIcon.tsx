interface HintIconProps {
  size?: number;
  className?: string;
}

/** Ampoule indice — même trait que les autres icônes ScanPlay. */
export function HintIcon({ size = 22, className = 'hint-icon' }: HintIconProps) {
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
        d="M8.2 10.2a3.8 3.8 0 1 1 7.6 0c0 1.7-1 2.6-1.7 3.4-.5.55-.8 1.15-.8 1.9H10.7c0-.75-.3-1.35-.8-1.9-.7-.8-1.7-1.7-1.7-3.4Z"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinejoin="round"
      />
      <path d="M10.4 18.4h3.2" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" />
      <path d="M10.8 20.4h2.4" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" />
    </svg>
  );
}
