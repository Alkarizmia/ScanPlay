/** WebP display assets (~10 KB). PNG kept as decode fallback. */
export const CHEST_CLOSED_SRC = '/chest/scanplay-chest-closed.webp?v=3';
export const CHEST_OPEN_SRC = '/chest/scanplay-chest-open.webp?v=3';
const CHEST_CLOSED_FALLBACK = '/chest/scanplay-chest-closed.png?v=3';
const CHEST_OPEN_FALLBACK = '/chest/scanplay-chest-open.png?v=3';

interface ScanPlayChestProps {
  open?: boolean;
  size?: number;
  className?: string;
  /** Gentle breathe — use on a ready, unopened thumbnail. */
  idle?: boolean;
  /** Stronger motion while the overlay is shaking / glowing. */
  busy?: boolean;
}

export function ScanPlayChest({
  open = false,
  size = 72,
  className = '',
  idle = false,
  busy = false,
}: ScanPlayChestProps) {
  const motion = busy ? 'scanplay-chest-art--busy' : idle && !open ? 'scanplay-chest-art--idle' : '';
  return (
    <img
      src={open ? CHEST_OPEN_SRC : CHEST_CLOSED_SRC}
      alt=""
      width={size}
      height={size}
      className={`scanplay-chest-art${motion ? ` ${motion}` : ''}${className ? ` ${className}` : ''}`}
      draggable={false}
      aria-hidden="true"
      decoding="async"
      onError={(event) => {
        const img = event.currentTarget;
        if (img.getAttribute('data-fallback') === '1') return;
        img.setAttribute('data-fallback', '1');
        img.src = open ? CHEST_OPEN_FALLBACK : CHEST_CLOSED_FALLBACK;
      }}
    />
  );
}
