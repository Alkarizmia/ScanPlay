import { ACHIEVEMENTS } from '../lib/achievements';
import { getAchievementDef } from '../lib/achievementUnlocks';
import { t } from '../lib/i18n';
import type { PublicUnlockRecord } from '../lib/social/types';
import type { Locale } from '../types';

interface FriendAchievementsGridProps {
  unlocks: PublicUnlockRecord[];
  locale: Locale;
  compact?: boolean;
}

export function FriendAchievementsGrid({ unlocks, locale, compact = false }: FriendAchievementsGridProps) {
  const unlockedIds = new Set(unlocks.map((u) => u.id));

  if (unlockedIds.size === 0) {
    return <p className="friend-achievements-empty">{t('friendAchievementsEmpty', locale)}</p>;
  }

  const visible = compact
    ? unlocks
        .slice(0, 8)
        .map((u) => getAchievementDef(u.id))
        .filter(Boolean)
    : ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id));

  return (
    <div className={`friend-achievements-grid ${compact ? 'friend-achievements-grid--compact' : ''}`}>
      {visible.map((ach) => {
        if (!ach) return null;
        return (
          <div key={ach.id} className="achievement-badge unlocked friend-achievement-badge" title={t(ach.descKey, locale)}>
            <span className="achievement-icon-wrap" aria-hidden="true">
              <span className="achievement-icon">{ach.icon}</span>
            </span>
            {!compact && (
              <>
                <span className="achievement-name">{t(ach.nameKey, locale)}</span>
                <span className="achievement-unlocked-tag">{t('achUnlocked', locale)}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
