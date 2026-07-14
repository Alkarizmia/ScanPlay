import type { ExpressionConfig, MascotExpression } from './types';

const SMILE: ExpressionConfig['mouth'] = { d: 'M 36 61 Q 50 71 64 61', strokeWidth: 2.5 };
const BIG_SMILE: ExpressionConfig['mouth'] = { d: 'M 32 58 Q 50 76 68 58', strokeWidth: 2.5 };
const NEUTRAL: ExpressionConfig['mouth'] = { d: 'M 40 64 L 60 64', strokeWidth: 2.5 };
const FROWN: ExpressionConfig['mouth'] = { d: 'M 38 67 Q 50 58 62 67', strokeWidth: 2.5 };
const OPEN: ExpressionConfig['mouth'] = { d: 'M 42 58 Q 50 70 58 58 Q 50 66 42 58 Z', fill: '#1e293b', strokeWidth: 0 };
const O_MOUTH: ExpressionConfig['mouth'] = { d: 'M 50 64 m -5 0 a 5 6 0 1 0 10 0 a 5 6 0 1 0 -10 0', fill: '#1e293b', strokeWidth: 0 };
const LAUGH: ExpressionConfig['mouth'] = { d: 'M 34 57 Q 50 78 66 57', strokeWidth: 2.5 };

export const EXPRESSION_CONFIG: Record<MascotExpression, ExpressionConfig> = {
  happy: { mouth: SMILE, eyes: 'open', armPose: 'wave', fx: 'none' },
  excited: { mouth: OPEN, eyes: 'wide', armPose: 'up', fx: 'confetti', tilt: -4 },
  proud: { mouth: SMILE, eyes: 'happy-closed', armPose: 'hips', fx: 'sparkle' },
  surprised: { mouth: O_MOUTH, eyes: 'wide', brows: 'raised', fx: 'none', tilt: 2 },
  thinking: { mouth: NEUTRAL, eyes: 'open', armPose: 'chin', fx: 'question', tilt: 5 },
  confused: { mouth: FROWN, eyes: 'open', brows: 'worried', fx: 'question', tilt: -6 },
  content: { mouth: SMILE, eyes: 'happy-closed', armPose: 'neutral', fx: 'none' },
  determined: { mouth: NEUTRAL, eyes: 'open', brows: 'angry', armPose: 'fists', fx: 'none' },
  tired: { mouth: FROWN, eyes: 'tired', armPose: 'neutral', fx: 'none', tilt: 8 },
  sad: { mouth: FROWN, eyes: 'open', brows: 'worried', armPose: 'neutral', fx: 'none', tilt: 5 },
  frustrated: { mouth: FROWN, eyes: 'squint', brows: 'angry', armPose: 'fists', fx: 'anger' },
  laughing: { mouth: LAUGH, eyes: 'happy-closed', armPose: 'up', fx: 'sparkle' },
  encouraging: { mouth: SMILE, eyes: 'open', armPose: 'thumbsup', fx: 'glow' },
  wink: { mouth: SMILE, eyes: 'wink-left', armPose: 'wave', fx: 'sparkle' },
  shocked: { mouth: O_MOUTH, eyes: 'wide', brows: 'raised', fx: 'none' },
  celebrating: { mouth: BIG_SMILE, eyes: 'happy-closed', armPose: 'up', fx: 'confetti' },
  satisfied: { mouth: SMILE, eyes: 'happy-closed', armPose: 'neutral', fx: 'sparkle' },
  motivated: { mouth: SMILE, eyes: 'open', armPose: 'fists', fx: 'glow' },
  sleepy: { mouth: NEUTRAL, eyes: 'tired', armPose: 'neutral', fx: 'none', tilt: 10 },
  applauding: { mouth: BIG_SMILE, eyes: 'happy-closed', armPose: 'clap', fx: 'confetti' },
  running: { mouth: SMILE, eyes: 'open', armPose: 'neutral', fx: 'none', tilt: -8 },
  jumping: { mouth: OPEN, eyes: 'wide', armPose: 'up', fx: 'confetti', tilt: -12 },
  highfive: { mouth: BIG_SMILE, eyes: 'open', armPose: 'highfive', fx: 'sparkle' },
  neutral: { mouth: NEUTRAL, eyes: 'open', armPose: 'neutral', fx: 'none' },
  curious: { mouth: NEUTRAL, eyes: 'open', armPose: 'chin', fx: 'question', tilt: -4 },
  focused: { mouth: NEUTRAL, eyes: 'open', brows: 'none', armPose: 'neutral', fx: 'glow' },
  wrong: { mouth: FROWN, eyes: 'squint', armPose: 'neutral', fx: 'none', tilt: 4 },
  combo: { mouth: BIG_SMILE, eyes: 'wide', armPose: 'up', fx: 'confetti' },
  levelup: { mouth: OPEN, eyes: 'wide', armPose: 'up', fx: 'confetti', tilt: -10 },
  chest: { mouth: SMILE, eyes: 'wide', armPose: 'neutral', prop: 'chest', fx: 'sparkle' },
  badge: { mouth: BIG_SMILE, eyes: 'happy-closed', armPose: 'up', prop: 'badge', fx: 'sparkle' },
  welcome: { mouth: BIG_SMILE, eyes: 'open', armPose: 'wave', fx: 'glow' },
  scanning: { mouth: SMILE, eyes: 'open', armPose: 'neutral', prop: 'book', fx: 'glow' },
  streak: { mouth: SMILE, eyes: 'open', armPose: 'neutral', prop: 'torch', fx: 'sparkle' },
  welcomed_back: { mouth: BIG_SMILE, eyes: 'open', armPose: 'wave', fx: 'sparkle' },
  reading: { mouth: NEUTRAL, eyes: 'open', armPose: 'neutral', prop: 'book', fx: 'none' },
};

export function resolveExpression(expression: MascotExpression): ExpressionConfig {
  return EXPRESSION_CONFIG[expression] ?? EXPRESSION_CONFIG.happy;
}

/** Map legacy 6-mood API to new expressions. */
export function legacyMoodToExpression(mood: string): MascotExpression {
  switch (mood) {
    case 'excited':
      return 'excited';
    case 'sad':
      return 'encouraging';
    case 'neutral':
      return 'neutral';
    case 'thinking':
      return 'thinking';
    case 'running':
      return 'running';
    default:
      return 'happy';
  }
}
