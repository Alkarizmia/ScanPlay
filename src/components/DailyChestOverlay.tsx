import { useEffect, useRef, useState } from 'react';
import { ScanPlayChest } from './ScanPlayChest';
import { Confetti } from './Confetti';
import { claimDailyChest, type ChestReward } from '../lib/shop';
import {
  chestRarityLabelKey,
  rollChestUpgrade,
  type ChestRarity,
} from '../lib/chestRarity';
import { vibrate } from '../lib/haptics';
import { mascotReactChest } from '../lib/mascot/reactions';
import { playSound } from '../lib/sounds';
import { t } from '../lib/i18n';
import { processNewUnlocks, snapshotUnlockedIds } from '../lib/achievementUnlocks';
import type { AchievementDef } from '../lib/achievements';
import { AchievementGlyph } from './icons/AchievementGlyph';
import { EconomyGlyph } from './icons/EconomyIcons';
import type { Locale } from '../types';

const UPGRADE_TAPS = 3;
const CLAIM_AFTER_SHAKE_MS = 480;
const GLOW_MS = 420;
const OPEN_MS = 280;

type ChestPhase = 'idle' | 'shake' | 'glow' | 'open' | 'reveal';

interface DailyChestOverlayProps {
  open: boolean;
  locale: Locale;
  onClose: () => void;
  onOpened: (reward: ChestReward, rarity: ChestRarity) => void;
  onNewUnlocks?: (unlocks: AchievementDef[]) => void;
  /** Défaut : coffre quotidien. Autre source (parcours) : ne pas appeler claimDailyChest. */
  claim?: (
    rarity: ChestRarity,
  ) => { ok: true; reward: ChestReward; rarity: ChestRarity } | { ok: false; reason: string };
}

const RARITY_CLASS: Record<ChestRarity, string> = {
  common: 'chest-rarity--common',
  rare: 'chest-rarity--rare',
  mythic: 'chest-rarity--mythic',
  legendary: 'chest-rarity--legendary',
};

function prefersReducedMotion(): boolean {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

export function DailyChestOverlay({
  open,
  locale,
  onClose,
  onOpened,
  onNewUnlocks,
  claim = claimDailyChest,
}: DailyChestOverlayProps) {
  const [rarity, setRarity] = useState<ChestRarity>('common');
  const [upgradeTaps, setUpgradeTaps] = useState(0);
  const [phase, setPhase] = useState<ChestPhase>('idle');
  const [reward, setReward] = useState<ChestReward | null>(null);
  const timers = useRef<number[]>([]);
  const claimedRef = useRef(false);
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;
  const claimRef = useRef(claim);
  claimRef.current = claim;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onNewUnlocksRef = useRef(onNewUnlocks);
  onNewUnlocksRef.current = onNewUnlocks;

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };

  useEffect(() => {
    if (!open) {
      clearTimers();
      setRarity('common');
      setUpgradeTaps(0);
      setPhase('idle');
      setReward(null);
      claimedRef.current = false;
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      clearTimers();
    };
  }, [open]);

  if (!open) return null;

  const revealed = phase === 'reveal';
  const showOpenArt = phase === 'open' || phase === 'reveal';
  const committed = reward != null;
  const fancyConfetti = revealed && (rarity === 'mythic' || rarity === 'legendary');

  const commitChest = (finalRarity: ChestRarity) => {
    if (claimedRef.current) return true;
    const before = snapshotUnlockedIds();
    const result = claimRef.current(finalRarity);
    if (!result.ok) {
      onCloseRef.current();
      return false;
    }
    claimedRef.current = true;
    setReward(result.reward);
    onOpenedRef.current(result.reward, result.rarity);
    const fresh = processNewUnlocks(before);
    if (fresh.length > 0) onNewUnlocksRef.current?.(fresh);
    mascotReactChest();
    playSound(finalRarity === 'legendary' ? 'levelUp' : 'goalComplete');
    vibrate([20, 60, 20, 60, 30]);
    return true;
  };

  const playOpenSequence = (finalRarity: ChestRarity) => {
    if (!commitChest(finalRarity)) return;
    if (prefersReducedMotion()) {
      setPhase('reveal');
      return;
    }
    setPhase('glow');
    later(() => {
      setPhase('open');
      later(() => setPhase('reveal'), OPEN_MS);
    }, GLOW_MS);
  };

  const handleUpgradeTap = () => {
    if (committed || upgradeTaps >= UPGRADE_TAPS) return;

    const nextRarity = rollChestUpgrade(rarity);
    const upgraded = nextRarity !== rarity;
    setRarity(nextRarity);
    const nextTaps = upgradeTaps + 1;
    setUpgradeTaps(nextTaps);
    setPhase('shake');
    playSound(upgraded ? 'xpGain' : 'tap');
    vibrate(upgraded ? [18, 40, 24] : [12, 20, 12]);

    if (nextTaps >= UPGRADE_TAPS) {
      if (prefersReducedMotion()) {
        playOpenSequence(nextRarity);
      } else {
        later(() => playOpenSequence(nextRarity), CLAIM_AFTER_SHAKE_MS);
      }
    } else {
      later(() => {
        setPhase((p) => (p === 'shake' ? 'idle' : p));
      }, 420);
    }
  };

  const upgradesLeft = Math.max(0, UPGRADE_TAPS - upgradeTaps);
  const shaking = phase === 'shake';
  const lastShake = shaking && upgradeTaps >= UPGRADE_TAPS;

  return (
    <div
      className="daily-chest-backdrop"
      role="presentation"
      onClick={committed ? onClose : undefined}
    >
      <div
        className={`daily-chest-stage daily-chest-stage--rarity ${RARITY_CLASS[rarity]}${revealed ? ' daily-chest-stage--revealed' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <Confetti active={fancyConfetti} contained />
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
          className={`daily-chest-gift daily-chest-chest${shaking ? ' daily-chest-gift--shake' : ''}${lastShake ? ' daily-chest-gift--shake-strong' : ''}${phase === 'glow' ? ' daily-chest-gift--glow' : ''}${showOpenArt ? ' daily-chest-gift--open' : ''}${phase === 'idle' && !committed ? ' daily-chest-gift--idle' : ''}`}
          onClick={committed ? undefined : handleUpgradeTap}
          disabled={committed}
          aria-label={t('shopOpenChest', locale)}
        >
          <ScanPlayChest
            open={showOpenArt}
            size={showOpenArt ? 188 : 168}
            idle={phase === 'idle' && !committed}
            busy={shaking || phase === 'glow'}
            className={`daily-chest-art${showOpenArt ? ' daily-chest-art--open' : ''}`}
          />
        </button>

        {revealed && reward && (
          <span className="daily-chest-reveal" aria-live="polite">
            <RewardDisplay reward={reward} locale={locale} />
          </span>
        )}

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
        <span className="daily-chest-reward-emoji" aria-hidden="true">
          <EconomyGlyph id="coin" size={56} />
        </span>
        <span className="daily-chest-reward-label">+{reward.amount}</span>
      </span>
    );
  }
  if (reward.type === 'xp') {
    return (
      <span className="daily-chest-reward-other">
        <span className="daily-chest-reward-emoji" aria-hidden="true">
          <EconomyGlyph id="xp" size={56} />
        </span>
        <span className="daily-chest-reward-label">+{reward.amount} XP</span>
      </span>
    );
  }
  if (reward.type === 'gems') {
    return (
      <span className="daily-chest-reward-other">
        <span className="daily-chest-reward-emoji" aria-hidden="true">
          <EconomyGlyph id="gem" size={56} />
        </span>
        <span className="daily-chest-reward-label">
          +{reward.amount} {t('dashGems', locale)}
        </span>
      </span>
    );
  }
  if (reward.type === 'xp_potion') {
    return (
      <span className="daily-chest-reward-other">
        <span className="daily-chest-reward-emoji" aria-hidden="true">
          <EconomyGlyph id="potion" size={56} />
        </span>
        <span className="daily-chest-reward-label">{t('chestRewardPotion', locale)}</span>
      </span>
    );
  }
  return (
    <span className="daily-chest-reward-other">
      <span className="daily-chest-reward-emoji" aria-hidden="true">
        <AchievementGlyph achievement={reward.achievement} size={56} />
      </span>
      <span className="daily-chest-reward-label">{t(reward.achievement.nameKey, locale)}</span>
    </span>
  );
}
