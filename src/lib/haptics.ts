import { isVibrationEnabled } from './preferences';

export type HapticPattern = 'tap' | 'success' | 'error' | 'achievement' | 'levelUp' | 'notification';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 8,
  success: [12, 40, 18],
  error: [20, 30, 20],
  achievement: [15, 50, 25, 50, 35],
  levelUp: [20, 40, 30, 40, 40, 60, 50],
  notification: [10, 60, 14],
};

export function vibrate(pattern: number | number[] = 10): void {
  if (!isVibrationEnabled()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

export function triggerHaptic(pattern: HapticPattern): void {
  vibrate(PATTERNS[pattern]);
}

export function hapticTap(): void {
  triggerHaptic('tap');
}

export function hapticCorrect(): void {
  triggerHaptic('success');
}

export function hapticWrong(): void {
  triggerHaptic('error');
}

export function hapticAchievement(): void {
  triggerHaptic('achievement');
}

export function hapticLevelUp(): void {
  triggerHaptic('levelUp');
}

export function hapticNotification(): void {
  triggerHaptic('notification');
}

/** @deprecated use hapticCorrect */
export function vibrateSuccess(): void {
  hapticCorrect();
}

/** @deprecated use hapticWrong */
export function vibrateError(): void {
  hapticWrong();
}
