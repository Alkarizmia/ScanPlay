import { createPortal } from 'react-dom';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface PrivacyPolicySheetProps {
  open: boolean;
  locale: Locale;
  onClose: () => void;
}

type PrivacyBlock =
  | { kind: 'heading'; key: 'privacyAboutHeading' }
  | {
      kind: 'paragraph';
      key:
        | 'privacyPolicy1'
        | 'privacyPolicy2'
        | 'privacyPolicy3'
        | 'privacyPolicy4'
        | 'privacyPolicy5'
        | 'privacyPolicy6'
        | 'privacyPolicy7'
        | 'privacyPolicy8'
        | 'privacyPolicy9'
        | 'privacyPolicy10';
    };

const PRIVACY_BLOCKS: PrivacyBlock[] = [
  { kind: 'paragraph', key: 'privacyPolicy1' },
  { kind: 'paragraph', key: 'privacyPolicy2' },
  { kind: 'paragraph', key: 'privacyPolicy3' },
  { kind: 'paragraph', key: 'privacyPolicy4' },
  { kind: 'paragraph', key: 'privacyPolicy5' },
  { kind: 'paragraph', key: 'privacyPolicy6' },
  { kind: 'paragraph', key: 'privacyPolicy9' },
  { kind: 'paragraph', key: 'privacyPolicy10' },
  { kind: 'heading', key: 'privacyAboutHeading' },
  { kind: 'paragraph', key: 'privacyPolicy7' },
  { kind: 'paragraph', key: 'privacyPolicy8' },
];

export function PrivacyPolicySheet({ open, locale, onClose }: PrivacyPolicySheetProps) {
  if (!open) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="install-sheet-backdrop"
        aria-label={t('back', locale)}
        onClick={onClose}
      />
      <div className="privacy-sheet" role="dialog" aria-labelledby="privacy-sheet-title">
        <button type="button" className="icon-btn privacy-sheet-close" onClick={onClose} aria-label={t('back', locale)}>
          ←
        </button>
        <h3 id="privacy-sheet-title" className="install-sheet-title">
          {t('privacySection', locale)}
        </h3>
        <p className="privacy-sheet-updated">{t('privacyUpdated', locale)}</p>
        <div className="privacy-sheet-body scroll-natural">
          {PRIVACY_BLOCKS.map((block) =>
            block.kind === 'heading' ? (
              <h4 key={block.key} className="privacy-sheet-heading">
                {t(block.key, locale)}
              </h4>
            ) : (
              <p key={block.key} className="privacy-sheet-paragraph">
                {t(block.key, locale)}
              </p>
            ),
          )}
        </div>
        <button type="button" className="btn-primary btn-lg privacy-sheet-close-btn" onClick={onClose}>
          {t('privacyClose', locale)}
        </button>
      </div>
    </>,
    document.body,
  );
}
