import { Logo } from './Logo';

export type MascotMood = 'happy' | 'excited' | 'sad' | 'neutral' | 'thinking' | 'running';

interface MascotProps {
  message: string;
  mood?: MascotMood;
  size?: number;
}

export function Mascot({ message, mood = 'happy', size = 56 }: MascotProps) {
  return (
    <div className={`mascot mascot--${mood}`}>
      <div className="mascot-icon">
        <Logo size={size} />
      </div>
      <p className="mascot-message">{message}</p>
    </div>
  );
}
