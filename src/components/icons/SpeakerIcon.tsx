interface SpeakerIconProps {
  size?: number;
  className?: string;
}

/** Haut-parleur vectoriel ScanPlay. */
export function SpeakerIcon({ size = 22, className = 'speaker-icon' }: SpeakerIconProps) {
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
        d="M4.5 9.2h3.1L12.2 5.8v12.4L7.6 14.8H4.5V9.2Z"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      <path
        d="M16 9.2c1.15.9 1.85 2.25 1.85 2.8s-.7 1.9-1.85 2.8"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M18.6 7c1.7 1.35 2.7 3.2 2.7 5s-1 3.65-2.7 5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
