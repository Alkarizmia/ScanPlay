interface StreakFlameProps {
  lit: boolean;
  size?: number;
  className?: string;
}

/** ScanPlay streak mark — not the system fire emoji. */
export function StreakFlame({ lit, size = 22, className = '' }: StreakFlameProps) {
  return (
    <svg
      className={`streak-flame${lit ? ' streak-flame--on' : ' streak-flame--off'} ${className}`.trim()}
      viewBox="0 0 32 40"
      width={size}
      height={Math.round(size * 1.25)}
      aria-hidden="true"
    >
      <path
        className="streak-flame-outer"
        d="M16 1.8c.4 6.2 4.8 9.4 7.6 13.2 2.6 3.5 4.2 7.2 4.2 11.2A11.8 11.8 0 0 1 16 38.2 11.8 11.8 0 0 1 4.2 26.2c0-4.6 1.8-8.4 4.6-12.2C11.8 10.2 15.6 7.4 16 1.8Z"
      />
      <path
        className="streak-flame-core"
        d="M16 13.4c1.6 3.2 4.7 4.8 4.7 8.8A4.7 4.7 0 0 1 16 27a4.7 4.7 0 0 1-4.7-4.8c0-4 3.1-5.6 4.7-8.8Z"
      />
    </svg>
  );
}
