import { useEffect, useState } from 'react';

import { DailyChestOverlay } from './DailyChestOverlay';
import { MascotCoach } from './mascot/MascotCoach';
import { ScanPlayChest } from './ScanPlayChest';
import { getUnlockedCount } from '../lib/achievements';
import { getGamification, getLevel, xpForNextLevel } from '../lib/gamification';
import { getDailyMissions, settleDailyMissionRewards } from '../lib/dailyMissions';
import { getDateLocale, t } from '../lib/i18n';
import { canClaimDailyChest, getCoins, getGems } from '../lib/wallet';
import type { ChestReward } from '../lib/shop';
import type { ChestRarity } from '../lib/chestRarity';
import type { Locale } from '../types';

interface HomeDashboardProps {
  locale: Locale;
  refreshKey?: number;
  welcomeMessage?: string;
  onRefresh?: () => void;
  onOpenShop?: () => void;
  onOpenAchievements?: () => void;
}

function formatStat(value: number, locale: Locale): string {
  return value.toLocaleString(getDateLocale(locale));
}

export function HomeDashboard({
  locale,
  refreshKey = 0,
  welcomeMessage,
  onRefresh,
  onOpenShop,
  onOpenAchievements,
}: HomeDashboardProps) {
  void refreshKey;
  const { streak, xp } = getGamification();
  const level = getLevel(xp);
  const { current, needed, progress } = xpForNextLevel(xp);
  const remainingXp = Math.max(0, needed - current);
  const coins = getCoins();
  const gems = getGems();
  const badges = getUnlockedCount();
  const chestReady = canClaimDailyChest();
  const missions = getDailyMissions();
  const [missionsOpen, setMissionsOpen] = useState(true);
  const [chestOverlayOpen, setChestOverlayOpen] = useState(false);
  const [missionTick, setMissionTick] = useState(0);
  void missionTick;

  useEffect(() => {
    if (settleDailyMissionRewards()) {
      setMissionTick((n) => n + 1);
      onRefresh?.();
    }
  }, [refreshKey]);

  const handleChestOpened = (_reward: ChestReward, _rarity?: ChestRarity) => {
    onRefresh?.();
  };

  return (
    <div className="home-dashboard" aria-label={t('homeProgressLabel', locale)}>
      <article className="dash-card dash-card--streak">
        <div className="dash-streak-body">
          <MascotCoach
            className="dash-streak-coach"
            expression={streak > 0 ? 'streak' : 'welcome'}
            size={56}
            message={welcomeMessage}
            placement="bubble-above"
            idle
            celebrate={streak > 0}
          />
          <div className="dash-streak-copy">
            <span className="dash-streak-label">
              <span className="icon-glyph icon-glyph--sm" aria-hidden="true">
                🔥
              </span>{' '}
              {t('dashStreakTitle', locale)}
            </span>
            <strong className="dash-streak-days">
              {t('dashStreakDays', locale).replace('{count}', String(streak))}
            </strong>
            <p className="dash-streak-msg">
              {streak > 0 ? t('dashStreakKeep', locale) : t('homeStreakCta', locale)}
            </p>
          </div>
        </div>
      </article>

      <article className="dash-card dash-card--level">
        <div className="dash-level-head">
          <span className="dash-level-title">
            {t('dashLevel', locale).replace('{level}', String(level))}
          </span>
          <span className="dash-level-xp">
            <span className="icon-glyph icon-glyph--sm" aria-hidden="true">
              ⚡
            </span>{' '}
            {formatStat(xp, locale)} XP
          </span>
        </div>
        <div className="dash-xp-bar" aria-label={t('xp', locale)}>
          <div className="dash-xp-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="dash-level-next">
          {t('dashXpToNext', locale)
            .replace('{xp}', formatStat(remainingXp, locale))
            .replace('{level}', String(level + 1))}
        </p>
      </article>

      <div className="dash-stats-row" role="group" aria-label={t('statsTitle', locale)}>
        <div className="dash-stat">
          <span className="dash-stat-icon icon-glyph icon-glyph--md" aria-hidden="true">
            🪙
          </span>
          <span className="dash-stat-val">{formatStat(coins, locale)}</span>
          <span className="dash-stat-label">{t('dashCoins', locale)}</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-icon icon-glyph icon-glyph--md" aria-hidden="true">
            💎
          </span>
          <span className="dash-stat-val">{formatStat(gems, locale)}</span>
          <span className="dash-stat-label">{t('dashGems', locale)}</span>
        </div>
        <button
          type="button"
          className="dash-stat dash-stat--btn"
          onClick={() => onOpenAchievements?.()}
        >
          <span className="dash-stat-icon icon-glyph icon-glyph--md" aria-hidden="true">
            🏅
          </span>
          <span className="dash-stat-val">{formatStat(badges, locale)}</span>
          <span className="dash-stat-label">{t('dashBadges', locale)}</span>
        </button>
      </div>

      <article className={`dash-card dash-card--chest${chestReady ? ' dash-card--chest-ready' : ''}`}>
        <button
          type="button"
          className="dash-chest-shop-hit"
          onClick={() => onOpenShop?.()}
          aria-label={t('shop', locale)}
        >
          <div className="dash-chest-visual" aria-hidden="true">
            <ScanPlayChest open={!chestReady} size={56} />
          </div>
          <div className="dash-chest-copy">
            <h3 className="dash-chest-title">{t('shopDailyChest', locale)}</h3>
            <p className={`dash-chest-status${chestReady ? ' ready' : ''}`}>
              {chestReady ? t('dashChestAvailable', locale) : t('shopChestDone', locale)}
            </p>
          </div>
        </button>
        <button
          type="button"
          className={`btn-primary dash-chest-btn${chestReady ? '' : ' dash-chest-btn--done'}`}
          disabled={!chestReady}
          onClick={() => {
            if (!chestReady) return;
            setChestOverlayOpen(true);
          }}
        >
          {chestReady ? t('dashChestOpen', locale) : t('shopChestDone', locale)}
        </button>
      </article>

      <section className="dash-card dash-card--missions">
        <button
          type="button"
          className="dash-missions-toggle"
          onClick={() => setMissionsOpen((open) => !open)}
          aria-expanded={missionsOpen}
        >
          <span>{t('dashMissionsTitle', locale)}</span>
          <span className={`dash-missions-chevron${missionsOpen ? ' open' : ''}`} aria-hidden="true">
            ›
          </span>
        </button>
        {missionsOpen && (
          <ul className="dash-mission-list">
            {missions.map((mission) => {
              const done = mission.current >= mission.goal;
              const pct = Math.min(100, (mission.current / mission.goal) * 100);
              const name = mission.count
                ? t(mission.nameKey, locale).replace('{count}', String(mission.count))
                : t(mission.nameKey, locale);
              return (
                <li
                  key={mission.id}
                  className={`dash-mission${done ? ' dash-mission--done' : ''}`}
                >
                  <div className="dash-mission-icon" aria-hidden="true">
                    {mission.id === 'chest' ? (
                      <ScanPlayChest open={!chestReady} size={32} />
                    ) : (
                      <span className="icon-glyph icon-glyph--md">{mission.icon}</span>
                    )}
                  </div>
                  <div className="dash-mission-body">
                    <span className="dash-mission-name">{name}</span>
                    <div className="dash-mission-progress" aria-hidden="true">
                      <div className="dash-mission-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="dash-mission-reward">
                    {mission.reward.type === 'coins' ? (
                      <>
                        <span className="dash-mission-reward-xp">+{mission.reward.amount}</span>
                        <span className="dash-mission-reward-xp-icon" aria-hidden="true">
                          🪙
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="dash-mission-reward-xp">+{mission.reward.amount} XP</span>
                        <span className="dash-mission-reward-xp-icon" aria-hidden="true">
                          ⚡
                        </span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <DailyChestOverlay
        open={chestOverlayOpen}
        locale={locale}
        onClose={() => setChestOverlayOpen(false)}
        onOpened={handleChestOpened}
      />
    </div>
  );
}
