import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Adds a one-shot "in view" flag. Elements start hidden only when motion is
 * allowed, so reduced-motion and no-IntersectionObserver users see content
 * immediately instead of an empty page.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);

  return { ref, shown } as const;
}

/**
 * True whenever the observed element is NOT in the viewport — whether it was
 * scrolled past (above) or has not been reached yet (below the fold).
 * Used to show the sticky CTA only when the hero CTA is out of sight.
 */
export function useOutOfView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [outOfView, setOutOfView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setOutOfView(!entry.isIntersecting);
      },
      // The bottom 80px is where the sticky bar sits: a CTA hidden under it counts as out of view.
      { threshold: 0, rootMargin: '0px 0px -80px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, outOfView } as const;
}
