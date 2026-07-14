import { useState } from 'react';

import { DailyChestOverlay } from './DailyChestOverlay';
import { MascotCoach } from './mascot/MascotCoach';
import { getUnlockedCount } from '../lib/achievements';
import { getGamification, getLevel, xpForNextLevel } from '../lib/gamification';
import { getHistory } from '../lib/history';
import { getDateLocale, t } from '../lib/i18n';
import { canClaimDailyChest, getCoins, getGems } from '../lib/wallet';
import type { ChestReward } from '../lib/shop';
import type { ChestRarity } from '../lib/chestRarity';
import type { Locale } from '../types';

const DAILY_SCAN_GOAL = 2;

interface HomeDashboardProps {
  locale: Locale;
  refreshKey?: number;
  welcomeMessage?: string;
  onRefresh?: () => void;
}

function formatStat(value: number, locale: Locale): string {
  return value.toLocaleString(getDateLocale(locale));
}

function getScansToday(): number {
  const today = new Date().toISOString().slice(0, 10);
  return getHistory().filter((entry) => entry.createdAt.startsWith(today)).length;
}

export function HomeDashboard({ locale, refreshKey = 0, welcomeMessage, onRefresh }: HomeDashboardProps) {
  void refreshKey;
  const { streak, xp } = getGamification();
  const level = getLevel(xp);
  const { current, needed, progress } = xpForNextLevel(xp);
  const remainingXp = Math.max(0, needed - current);
  const coins = getCoins();
  const gems = getGems();
  const badges = getUnlockedCount();
  const chestReady = canClaimDailyChest();
  const scansToday = getScansToday();
  const scanProgress = Math.min(100, (scansToday / DAILY_SCAN_GOAL) * 100);
  const [missionsOpen, setMissionsOpen] = useState(true);
  const [chestOverlayOpen, setChestOverlayOpen] = useState(false);

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
        <div className="dash-stat">
          <span className="dash-stat-icon icon-glyph icon-glyph--md" aria-hidden="true">
            🏅
          </span>
          <span className="dash-stat-val">{formatStat(badges, locale)}</span>
          <span className="dash-stat-label">{t('dashBadges', locale)}</span>
        </div>
      </div>

      <article className={`dash-card dash-card--chest${chestReady ? ' dash-card--chest-ready' : ''}`}>
        <div className="dash-chest-visual icon-glyph icon-glyph--xl" aria-hidden="true">
          📦
        </div>
        <div className="dash-chest-copy">
          <h3 className="dash-chest-title">{t('shopDailyChest', locale)}</h3>
          <p className={`dash-chest-status${chestReady ? ' ready' : ''}`}>
            {chestReady ? t('dashChestAvailable', locale) : t('shopChestDone', locale)}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary dash-chest-btn"
          disabled={!chestReady}
          onClick={() => setChestOverlayOpen(true)}
        >
          {t('dashChestOpen', locale)}
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
          <div className="dash-mission">
            <div className="dash-mission-icon icon-glyph icon-glyph--md" aria-hidden="true">
              📄
            </div>
            <div className="dash-mission-body">
              <span className="dash-mission-name">
                {t('dashMissionScan', locale).replace('{count}', String(DAILY_SCAN_GOAL))}
              </span>
              <div className="dash-mission-progress" aria-hidden="true">
                <div className="dash-mission-progress-fill" style={{ width: `${scanProgress}%` }} />
              </div>
            </div>
            <div className="dash-mission-reward">
              <span className="dash-mission-reward-xp">+50 XP</span>
              <span className="dash-mission-reward-coin" aria-hidden="true">
                🪙
              </span>
            </div>
          </div>
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
