import type { ExpressionConfig, MascotExpression } from './types';

/* Mouth above play badge (eyes ~y48, mouth ~y64, play ~y85). */
const SMILE: ExpressionConfig['mouth'] = { d: 'M 44 62 Q 60 74 76 62', strokeWidth: 3 };
const BIG_SMILE: ExpressionConfig['mouth'] = { d: 'M 40 60 Q 60 80 80 60', strokeWidth: 3 };
const NEUTRAL: ExpressionConfig['mouth'] = { d: 'M 48 66 L 72 66', strokeWidth: 3 };
const FROWN: ExpressionConfig['mouth'] = { d: 'M 46 70 Q 60 60 74 70', strokeWidth: 3 };
/** Soft encouraging pout for wrong (not a dramatic frown). */
const SOFT_POUT: ExpressionConfig['mouth'] = { d: 'M 50 68 Q 60 72 70 68', strokeWidth: 2.6 };
/** Open smile for correct (mascotReactCorrect → happy). */
const OPEN_SMILE: ExpressionConfig['mouth'] = {
  d: 'M 46 62 Q 60 78 74 62 Q 60 72 46 62 Z',
  fill: '#0f172a',
  strokeWidth: 0,
};
const OPEN: ExpressionConfig['mouth'] = { d: 'M 50 60 Q 60 76 70 60 Q 60 70 50 60 Z', fill: '#0f172a', strokeWidth: 0 };
const O_MOUTH: ExpressionConfig['mouth'] = { d: 'M 60 66 m -5 0 a 5 6 0 1 0 10 0 a 5 6 0 1 0 -10 0', fill: '#0f172a', strokeWidth: 0 };
const LAUGH: ExpressionConfig['mouth'] = { d: 'M 42 58 Q 60 82 78 58', strokeWidth: 3 };

export const EXPRESSION_CONFIG: Record<MascotExpression, ExpressionConfig> = {
  /* correct reaction → happy: open smile + content eyes; arms raised via CSS anim */
  happy: { mouth: OPEN_SMILE, eyes: 'happy-closed', armPose: 'neutral', fx: 'none' },
  excited: { mouth: OPEN, eyes: 'wide', armPose: 'up', fx: 'confetti', tilt: -4 },
  proud: { mouth: SMILE, eyes: 'happy-closed', armPose: 'hips', fx: 'sparkle' },
  surprised: { mouth: O_MOUTH, eyes: 'wide', brows: 'raised', fx: 'none', tilt: 2 },
  thinking: { mouth: NEUTRAL, eyes: 'open', armPose: 'chin', fx: 'question', tilt: 5 },
  confused: { mouth: FROWN, eyes: 'open', brows: 'worried', fx: 'question', tilt: -6 },
  /* Idle SVG uses content with open eyes; happy-closed reserved for correct. */
  content: { mouth: SMILE, eyes: 'open', armPose: 'neutral', fx: 'none' },
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
  /* wrong reaction: soft pout, raised brows; tilt via CSS anim (not container tilt) */
  wrong: { mouth: SOFT_POUT, eyes: 'open', brows: 'worried', armPose: 'neutral', fx: 'none' },
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
