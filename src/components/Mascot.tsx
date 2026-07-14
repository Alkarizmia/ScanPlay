import { MascotCoach } from './mascot/MascotCoach';
import type { MascotExpression } from '../lib/mascot/types';

export type { MascotExpression };
export type MascotMood = MascotExpression;

interface MascotProps {
  message: string;
  mood?: MascotExpression | string;
  size?: number;
  celebrate?: boolean;
}

export function Mascot({ message, mood = 'happy', size = 56, celebrate = false }: MascotProps) {
  return (
    <MascotCoach
      message={message}
      expression={mood}
      size={size}
      celebrate={celebrate}
      placement="card"
      className="mascot"
    />
  );
}

export { ScanPlayMascot as PixCompanion } from './mascot/ScanPlayMascot';
export { ScanPlayMascot } from './mascot/ScanPlayMascot';
