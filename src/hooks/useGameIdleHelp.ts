import { useCallback, useEffect, useRef, useState } from 'react';

export const GAME_IDLE_HELP_MS = 9000;
/** Only early taps (first second) restart the 9s timer — later taps don't push the hint away. */
export const GAME_IDLE_RESET_WINDOW_MS = 1000;

interface UseGameIdleHelpOptions {
  /** Off in exam mode / chapter skip / after reveal. */
  enabled: boolean;
  /** Bumps when the question changes — restarts the 9s timer. */
  resetKey: string | number;
  delayMs?: number;
}

/**
 * After `delayMs` without meaningful early interaction, expose soft help.
 * - Once shown, help stays until the question changes / disabled.
 * - Activity only restarts the countdown if it happens within the first 1s.
 */
export function useGameIdleHelp({
  enabled,
  resetKey,
  delayMs = GAME_IDLE_HELP_MS,
}: UseGameIdleHelpOptions) {
  const [helped, setHelped] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [cycle, setCycle] = useState(0);
  const helpedRef = useRef(false);
  const startedAtRef = useRef(0);
  const genRef = useRef(0);

  const bumpActivity = useCallback(() => {
    if (!enabled) return;
    if (helpedRef.current) return;
    if (Date.now() - startedAtRef.current >= GAME_IDLE_RESET_WINDOW_MS) return;
    setCycle((n) => n + 1);
  }, [enabled]);

  /** Skip the wait: show the hint now (tap the chip). */
  const revealNow = useCallback(() => {
    if (!enabled) return;
    if (helpedRef.current) return;
    genRef.current += 1;
    helpedRef.current = true;
    setHelped(true);
    setSecondsLeft(0);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      helpedRef.current = false;
      setHelped(false);
      setSecondsLeft(null);
      return;
    }

    const gen = ++genRef.current;
    helpedRef.current = false;
    setHelped(false);
    startedAtRef.current = Date.now();
    setSecondsLeft(Math.ceil(delayMs / 1000));

    const tick = window.setInterval(() => {
      if (genRef.current !== gen) return;
      const left = Math.max(0, Math.ceil((delayMs - (Date.now() - startedAtRef.current)) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        helpedRef.current = true;
        setHelped(true);
        window.clearInterval(tick);
      }
    }, 250);

    const helpAt = window.setTimeout(() => {
      if (genRef.current !== gen) return;
      helpedRef.current = true;
      setHelped(true);
      setSecondsLeft(0);
    }, delayMs);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(helpAt);
    };
  }, [enabled, resetKey, delayMs, cycle]);

  return { helped, secondsLeft, bumpActivity, revealNow };
}
