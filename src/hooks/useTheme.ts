import { useCallback, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'scanplay-theme';

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  // Guest / first visit: never follow the phone OS scheme — light until Settings.
  return 'light';
}

export function applyTheme(theme: Theme, options?: { persist?: boolean }): void {
  document.documentElement.setAttribute('data-theme', theme);
  if (options?.persist !== false) {
    localStorage.setItem(STORAGE_KEY, theme);
  }
  const bg = theme === 'dark' ? '#0b1220' : '#f8fafc';
  document.documentElement.style.backgroundColor = bg;
  document.documentElement.style.colorScheme = theme;
  document.body.style.backgroundColor = bg;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

/** Force light chrome without overwriting the user's saved Settings preference. */
export function applyGuestLightTheme(): void {
  applyTheme('light', { persist: false });
}

export function initTheme(): void {
  applyTheme(getInitialTheme());
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggle, isDark: theme === 'dark' };
}
