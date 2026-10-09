import type { DrivingCountryId } from '../../lib/universeDriving';

/** Compact SVG flags (emoji often renders as "BE"/"FR" on Windows). */
export function DrivingCountryFlag({
  id,
  className = '',
}: {
  id: DrivingCountryId;
  className?: string;
}) {
  const common = {
    viewBox: '0 0 36 24',
    className: `driving-flag-svg ${className}`.trim(),
    'aria-hidden': true as const,
  };

  switch (id) {
    case 'be':
      return (
        <svg {...common}>
          <rect width="12" height="24" fill="#000" />
          <rect x="12" width="12" height="24" fill="#fdda24" />
          <rect x="24" width="12" height="24" fill="#ef3340" />
        </svg>
      );
    case 'fr':
      return (
        <svg {...common}>
          <rect width="12" height="24" fill="#002395" />
          <rect x="12" width="12" height="24" fill="#fff" />
          <rect x="24" width="12" height="24" fill="#ed2939" />
        </svg>
      );
    case 'nl':
      return (
        <svg {...common}>
          <rect width="36" height="8" fill="#ae1c28" />
          <rect y="8" width="36" height="8" fill="#fff" />
          <rect y="16" width="36" height="8" fill="#21468b" />
        </svg>
      );
    case 'de':
      return (
        <svg {...common}>
          <rect width="36" height="8" fill="#000" />
          <rect y="8" width="36" height="8" fill="#dd0000" />
          <rect y="16" width="36" height="8" fill="#ffce00" />
        </svg>
      );
    case 'es':
      return (
        <svg {...common}>
          <rect width="36" height="6" fill="#c60b1e" />
          <rect y="6" width="36" height="12" fill="#ffc400" />
          <rect y="18" width="36" height="6" fill="#c60b1e" />
        </svg>
      );
    case 'lu':
      return (
        <svg {...common}>
          <rect width="36" height="8" fill="#ed2939" />
          <rect y="8" width="36" height="8" fill="#fff" />
          <rect y="16" width="36" height="8" fill="#00a1de" />
        </svg>
      );
    default:
      return null;
  }
}

export function DrivingChevron({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`driving-chevron ${className}`.trim()}
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
    >
      <path
        d="M9 6.5 15 12l-6 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
