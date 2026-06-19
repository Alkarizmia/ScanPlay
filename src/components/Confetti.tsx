import { useEffect, useState } from 'react';

interface ConfettiProps {
  active: boolean;
}

export function Confetti({ active }: ConfettiProps) {
  const [pieces, setPieces] = useState<{ id: number; left: number; delay: number; color: string }[]>([]);

  useEffect(() => {
    if (!active) {
      setPieces([]);
      return;
    }
    const colors = ['#10B981', '#34D399', '#6EE7B7', '#FBBF24'];
    setPieces(
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        color: colors[i % colors.length],
      })),
    );
    const t = setTimeout(() => setPieces([]), 2000);
    return () => clearTimeout(t);
  }, [active]);

  if (!pieces.length) return null;

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}
