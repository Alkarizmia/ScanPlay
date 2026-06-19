import { useEffect, useState } from 'react';

export function useMicLevel(stream: MediaStream | null, active: boolean): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!active || !stream?.active) {
      setLevel(0);
      return;
    }

    let ctx: AudioContext | null = null;
    let raf = 0;

    try {
      ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i]!;
        setLevel(Math.min(1, sum / data.length / 90));
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setLevel(0);
    }

    return () => {
      cancelAnimationFrame(raf);
      void ctx?.close();
      setLevel(0);
    };
  }, [stream, active]);

  return level;
}
