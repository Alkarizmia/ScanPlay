import type { MascotExpression, MascotReactionEvent, MascotReactionType } from './types';

export const MASCOT_EVENT = 'scanplay-mascot';

export function dispatchMascotReaction(event: MascotReactionEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<MascotReactionEvent>(MASCOT_EVENT, { detail: event }));
}

export function reactionToExpression(type: MascotReactionType, combo?: number): MascotExpression {
  switch (type) {
    case 'correct':
      return 'happy';
    case 'wrong':
      return 'wrong';
    case 'combo2':
    case 'combo3':
    case 'combo5':
      return combo && combo >= 5 ? 'combo' : 'excited';
    case 'levelup':
      return 'levelup';
    case 'streak':
      return 'streak';
    case 'chest':
      return 'chest';
    case 'badge':
      return 'badge';
    case 'scan_complete':
      return 'applauding';
    case 'welcome':
      return 'welcome';
    case 'welcomed_back':
      return 'welcomed_back';
    case 'mission':
      return 'celebrating';
    default:
      return 'happy';
  }
}

export function mascotReactCorrect(comboLevel: number, perfect = false): void {
  if (perfect) {
    dispatchMascotReaction({ type: 'correct', messageKey: 'mascotPerfect' });
    return;
  }
  if (comboLevel >= 5) {
    dispatchMascotReaction({ type: 'combo5', messageKey: 'mascotCombo5' });
  } else if (comboLevel >= 3) {
    dispatchMascotReaction({ type: 'combo3', messageKey: 'mascotCombo3' });
  } else if (comboLevel >= 2) {
    dispatchMascotReaction({ type: 'combo2', messageKey: 'mascotCombo2' });
  } else {
    dispatchMascotReaction({ type: 'correct', messageKey: 'mascotCorrect' });
  }
}

export function mascotReactWrong(): void {
  dispatchMascotReaction({ type: 'wrong', messageKey: 'mascotWrong' });
}

export function mascotReactLevelUp(): void {
  dispatchMascotReaction({ type: 'levelup', messageKey: 'mascotLevelUp' });
}

export function mascotReactStreak(days: number): void {
  dispatchMascotReaction({ type: 'streak', messageKey: 'mascotStreak', streak: days });
}

export function mascotReactChest(): void {
  dispatchMascotReaction({ type: 'chest', messageKey: 'mascotChest' });
}

export function mascotReactBadge(): void {
  dispatchMascotReaction({ type: 'badge', messageKey: 'mascotBadge' });
}

export function mascotReactScanComplete(): void {
  dispatchMascotReaction({ type: 'scan_complete', messageKey: 'mascotScanComplete' });
}

export function mascotReactWelcomeBack(): void {
  dispatchMascotReaction({ type: 'welcomed_back', messageKey: 'mascotWelcomeBack' });
}
