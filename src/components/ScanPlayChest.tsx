export const CHEST_CLOSED_SRC = '/chest/scanplay-chest-closed.png?v=2';
export const CHEST_OPEN_SRC = '/chest/scanplay-chest-open.png?v=2';

interface ScanPlayChestProps {
  open?: boolean;
  size?: number;
  className?: string;
}

export function ScanPlayChest({ open = false, size = 72, className = '' }: ScanPlayChestProps) {
  return (
    <img
      src={open ? CHEST_OPEN_SRC : CHEST_CLOSED_SRC}
      alt=""
      width={size}
      height={size}
      className={`scanplay-chest-art${className ? ` ${className}` : ''}`}
      draggable={false}
      aria-hidden="true"
    />
  );
}
