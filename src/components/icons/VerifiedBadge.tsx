interface VerifiedBadgeProps {
  size?: number;
  className?: string;
  title?: string;
}

/** Instagram-style blue check for ScanPlay Max. */
export function VerifiedBadge({ size = 16, className = '', title }: VerifiedBadgeProps) {
  return (
    <svg
      className={`verified-badge ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="#1d9bf0"
        d="M22.5 12.05c0-.56-.22-1.1-.62-1.5l-1.72-1.72.34-2.4a2.12 2.12 0 0 0-2.5-2.5l-2.4.34-1.72-1.72a2.12 2.12 0 0 0-3 0L9.16 4.27l-2.4-.34a2.12 2.12 0 0 0-2.5 2.5l.34 2.4-1.72 1.72a2.12 2.12 0 0 0 0 3l1.72 1.72-.34 2.4a2.12 2.12 0 0 0 2.5 2.5l2.4-.34 1.72 1.72a2.12 2.12 0 0 0 3 0l1.72-1.72 2.4.34a2.12 2.12 0 0 0 2.5-2.5l-.34-2.4 1.72-1.72c.4-.4.62-.94.62-1.5Z"
      />
      <path
        fill="#fff"
        d="M10.4 15.55 7.85 13l1.06-1.06 1.49 1.49 4.24-4.24 1.06 1.06-5.3 5.3Z"
      />
    </svg>
  );
}
