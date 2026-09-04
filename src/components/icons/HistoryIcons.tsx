import type { ReactElement } from 'react';

function Svg({ children, className }: { children: ReactElement | ReactElement[]; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function HistoryDecksIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="4" y="5" width="14" height="16" rx="2" />
      <path d="M8 9h6M8 13h6M8 17h4" />
      <path d="M18 7v12" />
    </Svg>
  );
}

export function HistoryChartIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15l3.5-4.5 3 2.5L19 7" />
    </Svg>
  );
}

export function HistoryPathIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <path d="M7.8 16.2 10.2 13.8M13.8 10.2 16.2 7.8" />
    </Svg>
  );
}

export function HistoryExamIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 8 12 4l8 4-8 4-8-4Z" />
      <path d="M8 10.5v5.2c2 1.4 6 1.4 8 0v-5.2" />
    </Svg>
  );
}

export function HistoryPlayIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M8 6.5v11L18 12 8 6.5Z" />
    </Svg>
  );
}

export function HistoryLockIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function HistoryStarIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12 3.5 14.4 9h5.8L16.6 12.8 18.8 18.5 12 15.2 5.2 18.5 7.4 12.8 3.8 9h5.8L12 3.5Z" />
    </Svg>
  );
}

export function HistoryClockIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5L15 15" />
    </Svg>
  );
}
