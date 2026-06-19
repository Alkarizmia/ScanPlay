import { useEffect } from 'react';
import { isSoundEnabled } from '../lib/preferences';
import { playSound } from '../lib/sounds';
import { hapticTap } from '../lib/haptics';

const SKIP_SELECTOR =
  '.game-screen .quiz-option, .game-screen .match-card, .game-screen .flashcard, .toggle, .audio-volume-slider';

const CARD_SELECTOR =
  '.sheet-type-card, .training-focus-card, .mode-card, .history-card-play, .import-card, .premium-card--interactive, .synthesis-choice-btn';

export function useGlobalTapSound(): void {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(SKIP_SELECTOR)) return;

      const card = target.closest(CARD_SELECTOR);
      const interactive = target.closest(
        'button, [role="button"], .bottom-nav-item, .scanplay-node',
      );

      if (card && isSoundEnabled()) {
        playSound('cardTap');
        hapticTap();
        return;
      }

      if (!interactive || !isSoundEnabled()) return;
      playSound('tap');
      hapticTap();
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
}
