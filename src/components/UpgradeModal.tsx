import { Mascot } from './Mascot';
import { usePlan } from '../hooks/usePlan';
import { t } from '../lib/i18n';
import type { Locale, UpgradeReason } from '../types';

interface UpgradeModalProps {
  reason: UpgradeReason;
  locale: Locale;
  onClose: () => void;
  onUpgrade: () => void;
}

type UpgradeMessageKey =
  | 'upgradeScans'
  | 'upgradeWords'
  | 'upgradeHistory'
  | 'upgradeHistoryReplay'
  | 'upgradeHistoryReplayPlus'
  | 'upgradeHistoryReplayPro'
  | 'upgradeFeature'
  | 'upgradeExport'
  | 'upgradeShare'
  | 'upgradeSynthesis'
  | 'upgradeExam'
  | 'upgradeStats'
  | 'upgradeMultiplayer';

const REASON_KEYS: Record<UpgradeReason, UpgradeMessageKey> = {
  scans: 'upgradeScans',
  words: 'upgradeWords',
  history: 'upgradeHistory',
  historyReplay: 'upgradeHistoryReplay',
  feature: 'upgradeFeature',
  export: 'upgradeExport',
  share: 'upgradeShare',
  synthesis: 'upgradeSynthesis',
  exam: 'upgradeExam',
  stats: 'upgradeStats',
  multiplayer: 'upgradeMultiplayer',
};

const PRO_REASONS = new Set<UpgradeReason>(['share', 'exam']);

export function UpgradeModal({ reason, locale, onClose, onUpgrade }: UpgradeModalProps) {
  const plan = usePlan();
  let messageKey = REASON_KEYS[reason];
  if (reason === 'historyReplay') {
    messageKey = plan === 'plus' ? 'upgradeHistoryReplayPro' : 'upgradeHistoryReplayPlus';
  }
  const ctaKey =
    reason === 'historyReplay'
      ? plan === 'plus'
        ? 'upgradePro'
        : 'upgradePlus'
      : PRO_REASONS.has(reason)
        ? 'upgradePro'
        : 'upgradePlus';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <Mascot message={t(messageKey, locale)} mood="encouraging" size={64} />
        <h3 className="modal-title">{t('upgradeTitle', locale)}</h3>
        <button type="button" className="btn-primary btn-lg" onClick={onUpgrade}>
          {t(ctaKey, locale)}
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          {t('gotIt', locale)}
        </button>
      </div>
    </div>
  );
}
