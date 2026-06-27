export type ScanPixMood = 'happy' | 'thinking' | 'running' | 'excited';

export interface ScanAdventureState {
  mood: ScanPixMood;
  checkpointKey:
    | 'scanningCheckpointStart'
    | 'scanningCheckpointMid'
    | 'scanningCheckpointLate'
    | 'scanningCheckpointFinish';
  flowStep: 'sheet' | 'game';
  rocket: boolean;
}

export function getScanAdventureState(progress: number): ScanAdventureState {
  const pct = Math.min(100, Math.max(0, progress));

  if (pct >= 92) {
    return {
      mood: 'excited',
      checkpointKey: 'scanningCheckpointFinish',
      flowStep: 'game',
      rocket: true,
    };
  }

  if (pct >= 65) {
    return {
      mood: 'running',
      checkpointKey: 'scanningCheckpointLate',
      flowStep: 'sheet',
      rocket: true,
    };
  }

  if (pct >= 30) {
    return {
      mood: 'thinking',
      checkpointKey: 'scanningCheckpointMid',
      flowStep: 'sheet',
      rocket: false,
    };
  }

  return {
    mood: 'happy',
    checkpointKey: 'scanningCheckpointStart',
    flowStep: 'sheet',
    rocket: false,
  };
}
