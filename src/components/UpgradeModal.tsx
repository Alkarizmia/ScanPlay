import { Mascot } from './Mascot';
import { t } from '../lib/i18n';
import type { Locale, UpgradeReason } from '../types';

interface UpgradeModalProps {
  reason: UpgradeReason;
  locale: Locale;
  onClose: () => void;
  onUpgrade: () => void;
}

const REASON_KEYS: Record<
  UpgradeReason,
  | 'upgradeScans'
  | 'upgradeWords'
  | 'upgradeHistory'
  | 'upgradeHistoryReplay'
  | 'upgradeFeature'
  | 'upgradeExport'
  | 'upgradeShare'
  | 'upgradeSynthesis'
  | 'upgradeExam'
  | 'upgradeStats'
  | 'upgradeMultiplayer'
> = {
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

const PRO_REASONS = new Set<UpgradeReason>(['share', 'exam', 'historyReplay']);

export function UpgradeModal({ reason, locale, onClose, onUpgrade }: UpgradeModalProps) {
  const ctaKey = PRO_REASONS.has(reason) ? 'upgradePro' : 'upgradePlus';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <Mascot message={t(REASON_KEYS[reason], locale)} mood="sad" size={64} />
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
