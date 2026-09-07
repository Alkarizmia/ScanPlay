import type { AchievementDef, AchievementFrame, AchievementId, AchievementSkin } from '../../lib/achievements';
import { getAchievementFrame, getAchievementSkin } from '../../lib/achievements';
import { ScanPlayChest } from '../ScanPlayChest';
import { StreakFlame } from './StreakFlame';
import {
  LootCards,
  LootCoin,
  LootFlag,
  LootGem,
  LootHint,
  LootMedal,
  LootMic,
  LootPeople,
  LootQuiz,
  LootScan,
  LootSynthesis,
  LootTiles,
  LootXp,
} from './EconomyIcons';

interface AchievementGlyphProps {
  achievement: Pick<AchievementDef, 'icon' | 'id'>;
  size?: number;
  className?: string;
  locked?: boolean;
  tier?: AchievementFrame;
}

function AchievementArt({
  id,
  size,
  locked,
}: {
  id: AchievementId;
  size: number;
  locked: boolean;
}) {
  const skin = getAchievementSkin(id);
  switch (skin) {
    case 'scan':
      return <LootScan size={size} />;
    case 'path':
      return <LootFlag size={size} />;
    case 'flame':
      return <StreakFlame lit={!locked} size={size} className={`ach-flame ach-flame--${id}`} />;
    case 'level':
      if (id === 'level_20') return <LootGem size={size} />;
      return <LootMedal size={size} />;
    case 'xp':
      return <LootXp size={size} />;
    case 'library':
      return <LootSynthesis size={size} />;
    case 'quiz':
      return <LootQuiz size={size} />;
    case 'cards':
      return <LootCards size={size} />;
    case 'match':
      return <LootTiles size={size} />;
    case 'gold':
      return <LootMedal size={size} />;
    case 'iron':
      return <LootCoin size={size} />;
    case 'mistakes':
      return <LootHint size={size} />;
    case 'exam':
      return <LootMedal size={size} />;
    case 'social':
      return <LootPeople size={size} />;
    case 'speak':
      return <LootMic size={size} />;
    case 'chest':
      return <ScanPlayChest open={!locked} size={size} idle={!locked} />;
    default:
      return <LootFlag size={size} />;
  }
}

/** Unique painted token per achievement — not the same medal for everyone. */
export function AchievementGlyph({
  achievement,
  size = 28,
  className = '',
  locked = false,
  tier,
}: AchievementGlyphProps) {
  const skin = getAchievementSkin(achievement.id);
  const frame = tier ?? getAchievementFrame(achievement.id, !locked);
  const artSize = Math.max(16, Math.round(size * 0.88));

  return (
    <span
      className={`ach-token ach-token--${skin} ach-token--${frame}${locked ? ' ach-token--locked' : ' ach-token--live'}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
    >
      <AchievementArt id={achievement.id} size={artSize} locked={locked} />
    </span>
  );
}

export type { AchievementSkin };
