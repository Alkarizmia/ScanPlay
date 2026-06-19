import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlan } from '../hooks/usePlan';
import { isLoggedIn } from '../lib/auth';
import { canUseSynthesis,
  getSynthesisRemaining,
  recordSynthesisUsage,
  synthesisQuotaLabel,
} from '../lib/synthesisQuota';
import {
  downloadSynthesisWord,
  generateSynthesis,
  isSynthesisEnabled,
  printSynthesisPdf,
  type SynthesisDocument,
  type SynthesisMode,
} from '../lib/synthesis';
import { t } from '../lib/i18n';
import { playSound } from '../lib/sounds';
import { SynthesisStudyView } from './SynthesisStudyView';
import type { Locale, SheetType, UpgradeReason, WordPair } from '../types';

interface SynthesisActionsProps {
  locale: Locale;
  pairs: WordPair[];
  thumbnail?: string;
  title?: string;
  sheetType?: SheetType;
  compact?: boolean;
  onUpgrade: (reason: UpgradeReason) => void;
  onToast: (message: string) => void;
  onAuth?: () => void;
}

type Step = 'idle' | 'choice' | 'loading' | 'study' | 'export';

export function SynthesisActions({
  locale,
  pairs,
  thumbnail,
  title,
  sheetType,
  compact = false,
  onUpgrade,
  onToast,
  onAuth,
}: SynthesisActionsProps) {
  const plan = usePlan();
  const [step, setStep] = useState<Step>('idle');
  const [doc, setDoc] = useState<SynthesisDocument | null>(null);
  const [quotaLabel, setQuotaLabel] = useState(() => synthesisQuotaLabel(plan));
  const [pendingMode, setPendingMode] = useState<SynthesisMode | null>(null);

  const defaultTitle = title ?? t('synthesisDefaultTitle', locale).replace('{count}', String(pairs.length));
  const overlayOpen = step !== 'idle';

  const refreshQuota = () => setQuotaLabel(synthesisQuotaLabel(plan));

  useEffect(() => {
    refreshQuota();
  }, [plan]);

  useEffect(() => {
    if (!overlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlayOpen]);

  const handleOpen = () => {
    if (!isSynthesisEnabled()) {
      onToast(t('synthesisUnavailable', locale));
      return;
    }
    if (!isLoggedIn()) {
      onToast(t('synthesisLoginRequired', locale));
      onAuth?.();
      return;
    }
    if (!canUseSynthesis(plan)) {
      if (plan === 'pro') {
        onToast(t('synthesisQuotaExhausted', locale));
      } else {
        onUpgrade('synthesis');
      }
      return;
    }
    if (pairs.length < 2) {
      onToast(t('synthesisNeedPairs', locale));
      return;
    }
    setPendingMode(null);
    setStep('choice');
  };

  const runGeneration = async (mode: SynthesisMode) => {
    setPendingMode(mode);
    setStep('loading');
    const result = await generateSynthesis({
      pairs,
      locale,
      mode,
      title: defaultTitle,
      sheetType,
      thumbnail,
    });

    if (!result) {
      setStep('idle');
      setPendingMode(null);
      onToast(t('synthesisError', locale));
      return;
    }

    recordSynthesisUsage();
    refreshQuota();
    setDoc(result);
    setPendingMode(null);
    playSound('summaryReady');

    if (mode === 'study') {
      setStep('study');
    } else {
      setStep('export');
    }
  };

  const closeAll = () => {
    if (step === 'loading') return;
    setStep('idle');
    setDoc(null);
    setPendingMode(null);
  };

  const overlay =
    step === 'idle'
      ? null
      : createPortal(
          <>
            {(step === 'choice' || step === 'loading') && (
              <div className="synthesis-sheet-layer" role="presentation">
                <button
                  type="button"
                  className="synthesis-sheet-backdrop-btn"
                  aria-label={t('back', locale)}
                  onClick={closeAll}
                  disabled={step === 'loading'}
                />
                <div
                  className="synthesis-sheet"
                  role="dialog"
                  aria-busy={step === 'loading'}
                  aria-labelledby="synthesis-choice-title"
                >
                  {step === 'loading' ? (
                    <div className="synthesis-sheet-loading" role="status" aria-live="polite">
                      <div className="synthesis-loading-spinner" aria-hidden="true" />
                      <p className="synthesis-sheet-loading-title">{t('synthesisGenerating', locale)}</p>
                      <p className="synthesis-sheet-desc">{t('synthesisWaitHint', locale)}</p>
                      {pendingMode && (
                        <p className="synthesis-sheet-pending">
                          {pendingMode === 'study'
                            ? t('synthesisStudyOnApp', locale)
                            : t('synthesisExport', locale)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <button type="button" className="synthesis-sheet-close icon-btn" onClick={closeAll}>
                        ✕
                      </button>
                      <h3 id="synthesis-choice-title">{t('synthesisChoiceTitle', locale)}</h3>
                      <p className="synthesis-sheet-desc">{t('synthesisChoiceDesc', locale)}</p>

                      <button
                        type="button"
                        className="synthesis-choice-btn synthesis-choice-btn--study"
                        onClick={() => void runGeneration('study')}
                      >
                        <span className="synthesis-choice-icon">🎮</span>
                        <span>
                          <strong>{t('synthesisStudyOnApp', locale)}</strong>
                          <small>{t('synthesisStudyOnAppDesc', locale)}</small>
                        </span>
                      </button>

                      <button
                        type="button"
                        className="synthesis-choice-btn synthesis-choice-btn--export"
                        onClick={() => void runGeneration('export')}
                      >
                        <span className="synthesis-choice-icon">📥</span>
                        <span>
                          <strong>{t('synthesisExport', locale)}</strong>
                          <small>{t('synthesisExportDesc', locale)}</small>
                        </span>
                      </button>

                      <p className="synthesis-sheet-foot">
                        {t('synthesisQuotaFoot', locale).replace('{label}', quotaLabel)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {step === 'study' && doc && (
              <SynthesisStudyView locale={locale} doc={doc} thumbnail={thumbnail} onClose={closeAll} />
            )}

            {step === 'export' && doc && (
              <div className="synthesis-sheet-layer" role="presentation">
                <button
                  type="button"
                  className="synthesis-sheet-backdrop-btn"
                  aria-label={t('back', locale)}
                  onClick={closeAll}
                />
                <div
                  className="synthesis-sheet"
                  role="dialog"
                  aria-labelledby="synthesis-export-title"
                >
                  <button type="button" className="synthesis-sheet-close icon-btn" onClick={closeAll}>
                    ✕
                  </button>
                  <h3 id="synthesis-export-title">{t('synthesisExportReady', locale)}</h3>
                  <p className="synthesis-sheet-desc">{doc.title}</p>

                  <button
                    type="button"
                    className="btn-primary btn-lg"
                    onClick={() => {
                      printSynthesisPdf(doc, thumbnail);
                      onToast(t('synthesisPdfHint', locale));
                    }}
                  >
                    📄 {t('synthesisExportPdf', locale)}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-lg"
                    onClick={() => {
                      downloadSynthesisWord(doc, thumbnail);
                      onToast(t('synthesisExportDone', locale));
                      closeAll();
                    }}
                  >
                    📝 {t('synthesisExportWord', locale)}
                  </button>
                  <button type="button" className="btn-ghost" onClick={closeAll}>
                    {t('gotIt', locale)}
                  </button>
                </div>
              </div>
            )}
          </>,
          document.body,
        );

  return (
    <>
      <div className={`synthesis-actions ${compact ? 'synthesis-actions--compact' : ''}`}>
        <button
          type="button"
          className="synthesis-action-btn"
          onClick={handleOpen}
          disabled={step === 'loading'}
          aria-busy={step === 'loading'}
        >
          ✨ {compact ? t('synthesisShort', locale) : t('synthesis', locale)}
          <span className="synthesis-quota-pill">{quotaLabel}</span>
        </button>
        {!compact && (
          <p className="synthesis-quota-hint">
            {t('synthesisQuotaHint', locale).replace('{remaining}', String(getSynthesisRemaining(plan)))}
          </p>
        )}
      </div>
      {overlay}
    </>
  );
}
