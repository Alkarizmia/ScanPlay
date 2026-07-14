/** Official ScanPlay mascot expressions (30+). */
export type MascotExpression =
  | 'happy'
  | 'excited'
  | 'proud'
  | 'surprised'
  | 'thinking'
  | 'confused'
  | 'content'
  | 'determined'
  | 'tired'
  | 'sad'
  | 'frustrated'
  | 'laughing'
  | 'encouraging'
  | 'wink'
  | 'shocked'
  | 'celebrating'
  | 'satisfied'
  | 'motivated'
  | 'sleepy'
  | 'applauding'
  | 'running'
  | 'jumping'
  | 'highfive'
  | 'neutral'
  | 'curious'
  | 'focused'
  | 'wrong'
  | 'combo'
  | 'levelup'
  | 'chest'
  | 'badge'
  | 'welcome'
  | 'scanning'
  | 'streak'
  | 'welcomed_back'
  | 'reading';

/** @deprecated Use MascotExpression */
export type MascotMood = MascotExpression;

export type MascotAccessoryId =
  | 'sweatband'
  | 'cap'
  | 'glasses'
  | 'mortarboard'
  | 'crown'
  | 'cape'
  | 'santa_hat'
  | 'pumpkin'
  | 'sunglasses'
  | 'backpack';

export type MascotPropId = 'torch' | 'trophy' | 'confetti' | 'book' | 'badge' | 'chest';

export type MascotReactionType =
  | 'correct'
  | 'wrong'
  | 'combo2'
  | 'combo3'
  | 'combo5'
  | 'levelup'
  | 'streak'
  | 'chest'
  | 'badge'
  | 'scan_complete'
  | 'welcome'
  | 'welcomed_back'
  | 'mission';

export interface MascotReactionEvent {
  type: MascotReactionType;
  messageKey?: string;
  streak?: number;
}

export interface MouthShape {
  d: string;
  strokeWidth?: number;
  fill?: string;
}

export interface ExpressionConfig {
  mouth: MouthShape;
  eyes: 'open' | 'closed' | 'wide' | 'squint' | 'wink-left' | 'wink-right' | 'tired' | 'happy-closed';
  brows?: 'none' | 'raised' | 'angry' | 'worried';
  armPose?: 'neutral' | 'wave' | 'up' | 'clap' | 'hips' | 'highfive' | 'thumbsup' | 'chin' | 'fists';
  prop?: MascotPropId;
  fx?: 'none' | 'sparkle' | 'confetti' | 'glow' | 'question' | 'anger';
  tilt?: number;
}
