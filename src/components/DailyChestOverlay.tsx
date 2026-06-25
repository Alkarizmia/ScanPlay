import { useEffect, useState } from 'react';
import { claimDailyChest, type ChestReward } from '../lib/shop';
import {
  chestRarityLabelKey,
  rollChestUpgrade,
  type ChestRarity,
} from '../lib/chestRarity';
import { vibrate } from '../lib/haptics';
import { playSound } from '../lib/sounds';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

const UPGRADE_TAPS = 3;

interface DailyChestOverlayProps {
  open: boolean;
  locale: Locale;
  onClose: () => void;
  onOpened: (reward: ChestReward, rarity: ChestRarity) => void;
}

const RARITY_CLASS: Record<ChestRarity, string> = {
  common: 'chest-rarity--common',
  rare: 'chest-rarity--rare',
  mythic: 'chest-rarity--mythic',
  legendary: 'chest-rarity--legendary',
};

export function DailyChestOverlay({ open, locale, onClose, onOpened }: DailyChestOverlayProps) {
  const [rarity, setRarity] = useState<ChestRarity>('common');
  const [upgradeTaps, setUpgradeTaps] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [reward, setReward] = useState<ChestReward | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!open) {
      setRarity('common');
      setUpgradeTaps(0);
      setShaking(false);
      setReward(null);
      setRevealed(false);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const upgradesLeft = Math.max(0, UPGRADE_TAPS - upgradeTaps);

  const openChest = (finalRarity: ChestRarity) => {
    const result = claimDailyChest(finalRarity);
    if (!result.ok) {
      onClose();
      return;
    }
    setReward(result.reward);
    setRevealed(true);
    onOpened(result.reward, result.rarity);
    playSound(finalRarity === 'legendary' ? 'levelUp' : 'goalComplete');
    vibrate([20, 60, 20, 60, 30]);
  };

  const handleUpgradeTap = () => {
    if (revealed || upgradeTaps >= UPGRADE_TAPS) return;

    const nextRarity = rollChestUpgrade(rarity);
    const upgraded = nextRarity !== rarity;
    setRarity(nextRarity);
    const nextTaps = upgradeTaps + 1;
    setUpgradeTaps(nextTaps);
    setShaking(true);
    playSound(upgraded ? 'xpGain' : 'tap');
    vibrate(upgraded ? [18, 40, 24] : [12, 20, 12]);
    window.setTimeout(() => setShaking(false), 420);

    if (nextTaps >= UPGRADE_TAPS) {
      window.setTimeout(() => openChest(nextRarity), 480);
    }
  };

  return (
    <div className="daily-chest-backdrop" role="presentation" onClick={revealed ? onClose : undefined}>
      <div
        className={`daily-chest-stage daily-chest-stage--rarity ${RARITY_CLASS[rarity]}${revealed ? ' daily-chest-stage--revealed' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={`daily-chest-rarity-label ${RARITY_CLASS[rarity]}`}>
          {t(chestRarityLabelKey(rarity), locale)}
        </p>

        {!revealed && (
          <p className="daily-chest-hint">
            {upgradesLeft > 0
              ? t('chestUpgradeHint', locale).replace('{left}', String(upgradesLeft))
              : t('chestTapOpen', locale)}
          </p>
        )}

        <button
          type="button"
          className={`daily-chest-gift daily-chest-chest${shaking ? ' daily-chest-gift--shake' : ''}${revealed ? ' daily-chest-gift--open' : ''}`}
          onClick={revealed ? undefined : handleUpgradeTap}
          disabled={revealed}
          aria-label={t('shopOpenChest', locale)}
        >
          <span className="daily-chest-chest-body" aria-hidden="true" />
          {revealed && reward && (
            <span className="daily-chest-reveal" aria-live="polite">
              <RewardDisplay reward={reward} locale={locale} />
            </span>
          )}
        </button>

        {!revealed && (
          <div className="daily-chest-upgrade-row" aria-hidden="true">
            {Array.from({ length: UPGRADE_TAPS }, (_, i) => (
              <span
                key={i}
                className={`daily-chest-upgrade-dot${i < upgradeTaps ? ' daily-chest-upgrade-dot--used' : ''}`}
              />
            ))}
          </div>
        )}

        {revealed && (
          <>
            <p className="daily-chest-opened-msg">{t('chestOpened', locale)}</p>
            <button type="button" className="btn-primary btn-lg daily-chest-collect" onClick={onClose}>
              {t('chestCollect', locale)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function RewardDisplay({ reward, locale }: { reward: ChestReward; locale: Locale }) {
  if (reward.type === 'coins') {
    return (
      <span className="daily-chest-reward-coins">
        <span className="daily-chest-coin-icon" aria-hidden="true">
          🪙
        </span>
        <span className="daily-chest-coin-amount">+{reward.amount}</span>
      </span>
    );
  }
  if (reward.type === 'xp') {
    return (
      <span className="daily-chest-reward-other">
        <span className="daily-chest-reward-icon">✨</span>
        <span>+{reward.amount} XP</span>
      </span>
    );
  }
  if (reward.type === 'xp_potion') {
    return (
      <span className="daily-chest-reward-other">
        <span className="daily-chest-reward-icon">⚗️</span>
        <span>{t('chestRewardPotion', locale)}</span>
      </span>
    );
  }
  return (
    <span className="daily-chest-reward-other">
      <span className="daily-chest-reward-icon">{reward.achievement.icon}</span>
      <span>{t(reward.achievement.nameKey, locale)}</span>
    </span>
  );
}
