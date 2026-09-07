import { useState } from 'react';
import { DailyChestOverlay } from './DailyChestOverlay';
import { LootCoin, LootQuiz, LootScan, LootXp } from './icons/EconomyIcons';
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
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [opened, setOpened] = useState(false);

  const finish = () => {
    if (!opened && pending.length > 0) {
      claimPendingMissionChest();
    }
    onDone();
  };

  return (
    <div className="screen flow-screen mission-reward-screen">
      <main className="mission-reward-main">
        <h2 className="mission-reward-title">{t('missionRewardTitle', locale)}</h2>
        <p className="mission-reward-hint">{t('missionRewardHint', locale)}</p>
        <ul className="mission-reward-list">
          {missions.map((mission) => {
            const done = mission.current >= mission.goal;
            const pct = Math.min(100, (mission.current / mission.goal) * 100);
            const name = mission.count
              ? t(mission.nameKey, locale).replace('{count}', String(mission.count))
              : t(mission.nameKey, locale);
            return (
              <li key={mission.id} className={`dash-mission dash-mission--${mission.id}${done ? ' dash-mission--done' : ''}`}>
                <div className="dash-mission-icon" aria-hidden="true">
                  {mission.id === 'chest' ? (
                    <ScanPlayChest open={done} size={30} idle={!done} />
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
                      <LootCoin size={16} />
                    </>
                  ) : (
                    <>
                      <span className="dash-mission-reward-xp">+{mission.reward.amount}</span>
                      <LootXp size={16} />
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {pending.length > 0 && !opened ? (
          <button type="button" className="btn-primary btn-lg" onClick={() => setOverlayOpen(true)}>
            {t('missionRewardOpen', locale)}
          </button>
        ) : (
          <button type="button" className="btn-primary btn-lg" onClick={finish}>
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
