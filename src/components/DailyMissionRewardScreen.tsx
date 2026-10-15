import { useMemo, useState } from 'react';
import { DailyChestOverlay } from './DailyChestOverlay';
import { LootQuiz, LootScan } from './icons/EconomyIcons';
import { ScanPlayChest } from './ScanPlayChest';
import {
  claimPendingMissionChest,
  getDailyMissions,
  getUnclaimedCompletedMissions,
} from '../lib/dailyMissions';
import { t } from '../lib/i18n';
import type { AchievementDef } from '../lib/achievements';
import type { Locale } from '../types';

interface DailyMissionRewardScreenProps {
  locale: Locale;
  onDone: () => void;
  onNewUnlocks?: (unlocks: AchievementDef[]) => void;
}

export function DailyMissionRewardScreen({ locale, onDone, onNewUnlocks }: DailyMissionRewardScreenProps) {
  const missions = getDailyMissions();
  const pending = getUnclaimedCompletedMissions();
  const pendingIds = useMemo(() => new Set(pending.map((m) => m.id)), [pending]);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const chestCount = pending.length;

  const finish = () => {
    if (!opened && pending.length > 0) {
      claimPendingMissionChest();
    }
    onDone();
  };

  return (
    <div className="screen flow-screen mission-reward-screen mission-reward-screen--loot">
      <main className="mission-reward-main">
        <p className="mission-reward-eyebrow">{t('missionRewardTitle', locale)}</p>
        <h2 className="mission-reward-title">
          {chestCount > 1
            ? t('missionRewardChestTitleMany', locale).replace('{count}', String(chestCount))
            : t('missionRewardChestTitle', locale)}
        </h2>
        <p className="mission-reward-hint">{t('missionRewardChestHint', locale)}</p>

        <div className="mission-reward-hero" aria-hidden="true">
          <div className={`mission-reward-hero-glow${opened ? ' mission-reward-hero-glow--done' : ''}`} />
          <ScanPlayChest open={opened} size={132} idle={!opened} />
        </div>

        <ul className="mission-reward-list">
          {missions.map((mission) => {
            const done = mission.current >= mission.goal;
            const awaitingChest = pendingIds.has(mission.id);
            const pct = Math.min(100, (mission.current / mission.goal) * 100);
            const name = mission.count
              ? t(mission.nameKey, locale).replace('{count}', String(mission.count))
              : t(mission.nameKey, locale);
            return (
              <li
                key={mission.id}
                className={`dash-mission dash-mission--${mission.id}${done ? ' dash-mission--done' : ''}${awaitingChest ? ' dash-mission--loot' : ''}`}
              >
                <div className="dash-mission-icon" aria-hidden="true">
                  {mission.id === 'chest' ? (
                    <ScanPlayChest open={done && !awaitingChest} size={30} idle={awaitingChest} />
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
                <div
                  className={`dash-mission-reward${awaitingChest ? ' dash-mission-reward--chest' : done ? ' dash-mission-reward--claimed' : ''}`}
                >
                  {awaitingChest ? (
                    <>
                      <ScanPlayChest open={false} size={22} idle />
                      <span className="dash-mission-reward-xp">{t('missionRewardChestBadge', locale)}</span>
                    </>
                  ) : done ? (
                    <span className="dash-mission-reward-xp">{t('missionRewardClaimed', locale)}</span>
                  ) : (
                    <span className="dash-mission-reward-xp">{t('missionRewardLocked', locale)}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {pending.length > 0 && !opened ? (
          <button
            type="button"
            className="btn-primary btn-lg mission-reward-cta"
            onClick={() => setOverlayOpen(true)}
          >
            {t('missionRewardOpenChest', locale)}
          </button>
        ) : (
          <button type="button" className="btn-primary btn-lg mission-reward-cta" onClick={finish}>
            {t('missionRewardContinue', locale)}
          </button>
        )}
      </main>

      <DailyChestOverlay
        open={overlayOpen}
        locale={locale}
        claim={claimPendingMissionChest}
        onClose={() => {
          setOverlayOpen(false);
          if (opened) onDone();
        }}
        onOpened={() => {
          setOpened(true);
        }}
        onNewUnlocks={onNewUnlocks}
      />
    </div>
  );
}
