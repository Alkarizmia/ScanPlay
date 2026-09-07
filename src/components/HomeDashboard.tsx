import { useEffect, useRef, useState, type ReactNode } from 'react';

import { DailyChestOverlay } from './DailyChestOverlay';
import { StreakFlame } from './icons/StreakFlame';
import { EconomyGlyph, LootCoin, LootGem, LootMedal, LootQuiz, LootScan, LootXp } from './icons/EconomyIcons';
import { MascotCoach } from './mascot/MascotCoach';
import { ScanPlayChest } from './ScanPlayChest';
import { getUnlockedCount } from '../lib/achievements';
import { getGamification, getLevel, xpForNextLevel } from '../lib/gamification';
import { getDailyMissions, settleDailyMissionRewards } from '../lib/dailyMissions';
import { getDateLocale, t } from '../lib/i18n';
import { canClaimDailyChest, getCoins, getGems } from '../lib/wallet';
import type { ChestReward } from '../lib/shop';
import type { ChestRarity } from '../lib/chestRarity';
import type { AchievementDef } from '../lib/achievements';
import type { Locale } from '../types';

interface HomeDashboardProps {
  locale: Locale;
  refreshKey?: number;
  welcomeMessage?: string;
  onRefresh?: () => void;
  onOpenShop?: () => void;
  onOpenAchievements?: () => void;
  onNewUnlocks?: (unlocks: AchievementDef[]) => void;
}

function formatStat(value: number, locale: Locale): string {
  return value.toLocaleString(getDateLocale(locale));
}

function useLootGain(value: number): { popping: boolean; delta: number } {
  const prev = useRef(value);
  const [popping, setPopping] = useState(false);
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    const before = prev.current;
    if (value > before) {
      setDelta(value - before);
      setPopping(true);
      const id = window.setTimeout(() => setPopping(false), 980);
      prev.current = value;
      return () => window.clearTimeout(id);
    }
    prev.current = value;
    return undefined;
  }, [value]);

  return { popping, delta };
}

function DashLootStat({
  kind,
  value,
  label,
  locale,
  token,
  onClick,
}: {
  kind: 'coin' | 'gem' | 'badge';
  value: number;
  label: string;
  locale: Locale;
  token: ReactNode;
  onClick?: () => void;
}) {
  const { popping, delta } = useLootGain(value);
  const className = `dash-stat dash-stat--loot dash-stat--${kind}${onClick ? ' dash-stat--btn' : ''}${popping ? ' dash-stat--gain' : ''}`;

  const body = (
    <>
      <span className="dash-loot-well" aria-hidden="true">
        <span className="dash-loot-spark dash-loot-spark--a" />
        <span className="dash-loot-spark dash-loot-spark--b" />
        <span className="dash-loot-spark dash-loot-spark--c" />
        {token}
      </span>
      <span className="dash-stat-val">{formatStat(value, locale)}</span>
      <span className="dash-stat-label">{label}</span>
      {popping && delta > 0 && (
        <span className="dash-loot-delta" aria-hidden="true">
          +{delta}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}

export function HomeDashboard({
  locale,
  refreshKey = 0,
  welcomeMessage,
  onRefresh,
  onOpenShop,
  onOpenAchievements,
  onNewUnlocks,
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
      <article className="dash-card dash-card--welcome">
        <div className="dash-welcome-row">
          <MascotCoach
            className="dash-streak-coach"
            expression={streak > 0 ? 'streak' : 'welcome'}
            size={40}
            placement="compact"
            bubble={false}
            idle
            celebrate={streak > 0}
          />
          <p className="dash-welcome-msg">{welcomeMessage}</p>
          <span
            className={`dash-streak-badge${streak > 0 ? ' dash-streak-badge--lit' : ''}`}
            title={t('dashStreakTitle', locale)}
          >
            <StreakFlame lit={streak > 0} size={16} />
            <span className="dash-streak-badge-val">{streak}</span>
          </span>
        </div>
      </article>

      <article className="dash-card dash-card--level">
        <div className="dash-level-head">
          <span className="dash-level-title">
            {t('dashLevel', locale).replace('{level}', String(level))}
          </span>
          <span className="dash-level-xp">
            <span className="icon-glyph icon-glyph--sm" aria-hidden="true">
              <EconomyGlyph id="xp" size={14} />
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
        <DashLootStat
          kind="coin"
          value={coins}
          label={t('dashCoins', locale)}
          locale={locale}
          token={<LootCoin size={34} />}
        />
        <DashLootStat
          kind="gem"
          value={gems}
          label={t('dashGems', locale)}
          locale={locale}
          token={<LootGem size={34} />}
        />
        <DashLootStat
          kind="badge"
          value={badges}
          label={t('dashBadges', locale)}
          locale={locale}
          token={<LootMedal size={34} />}
          onClick={() => onOpenAchievements?.()}
        />
      </div>

      <article className={`dash-card dash-card--chest${chestReady ? ' dash-card--chest-ready' : ''}`}>
        <button
          type="button"
          className="dash-chest-shop-hit"
          onClick={() => onOpenShop?.()}
          aria-label={t('shop', locale)}
        >
          <div className="dash-chest-visual" aria-hidden="true">
            <ScanPlayChest open={!chestReady} size={56} idle={chestReady} />
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
                  className={`dash-mission dash-mission--${mission.id}${done ? ' dash-mission--done' : ''}`}
                >
                  <div className="dash-mission-icon" aria-hidden="true">
                    {mission.id === 'chest' ? (
                      <ScanPlayChest open={!chestReady} size={30} idle={chestReady} />
                    ) : mission.id === 'scan' ? (
                      <LootScan size={28} />
                    ) : (
                      <LootQuiz size={28} />
                    )}
                  </div>
                  <div className="dash-mission-body">
                    <span className="dash-mission-name">{name}</span>
                    <div className="dash-mission-progress" aria-hidden="true">
                      <div
                        className={`dash-mission-progress-fill${done ? ' dash-mission-progress-fill--done' : ''}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className={`dash-mission-reward${mission.reward.type === 'coins' ? ' dash-mission-reward--coins' : ' dash-mission-reward--xp'}`}>
                    {mission.reward.type === 'coins' ? (
                      <>
                        <span className="dash-mission-reward-xp">+{mission.reward.amount}</span>
                        <span className="dash-mission-reward-xp-icon" aria-hidden="true">
                          <LootCoin size={16} />
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="dash-mission-reward-xp">+{mission.reward.amount}</span>
                        <span className="dash-mission-reward-xp-icon" aria-hidden="true">
                          <LootXp size={16} />
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
        onNewUnlocks={onNewUnlocks}
      />
    </div>
  );
}
