import { useEffect } from 'react';
import { isLoggedIn } from '../lib/auth';
import { todayKey, validateStreak } from '../lib/gamification';

/** Re-validates streak when the calendar day changes (midnight) or tab refocuses. */
export function useStreakDayWatcher(onDayChange: (justLost: boolean) => void): void {
  useEffect(() => {
    if (!isLoggedIn()) return;

    let lastDay = todayKey();

    const check = () => {
      const today = todayKey();
      if (today === lastDay) return;
      lastDay = today;
      const { justLost } = validateStreak();
      onDayChange(justLost);
    };

    const intervalId = window.setInterval(check, 30_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [onDayChange]);
}
