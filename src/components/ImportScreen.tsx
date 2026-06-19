import { useEffect, useRef, useState } from 'react';

import { BrandDecor } from './BrandDecor';
import { SheetTypePicker } from './SheetTypePicker';
import { TrainingFocusPicker } from './TrainingFocusPicker';
import { clampImagesForImport, getMaxImagesPerImport, getMaxWords } from '../lib/planLimits';
import { isTrainingFocusApplicable } from '../lib/trainingFocus';
import { t } from '../lib/i18n';
import type { Locale, SheetType, TrainingFocus } from '../types';

interface ImportScreenProps {
  locale: Locale;
  sheetType: SheetType;
  importError?: string | null;
  isDesktop: boolean;
  initialFiles?: File[];
  onBack: () => void;
  onSheetTypeChange: (type: SheetType) => void;
  onFile: (file: File | File[], trainingFocus: TrainingFocus[]) => void;
  onToast?: (message: string) => void;
}

type ImportStep = 'pick' | 'configure';

const DEFAULT_FOCUS: TrainingFocus[] = ['written', 'oral'];

function hintKeyForSheetType(
  sheetType: SheetType,
): 'importHintVocab' | 'importHintNotes' | 'importHintDefinitions' | 'importHintMath' {
  if (sheetType === 'notes') return 'importHintNotes';
  if (sheetType === 'definitions') return 'importHintDefinitions';
  if (sheetType === 'math') return 'importHintMath';
  return 'importHintVocab';
}

export function ImportScreen({
  locale,
  sheetType,
  importError,
  isDesktop,
  initialFiles,
  onBack,
  onSheetTypeChange,
  onFile,
  onToast,
}: ImportScreenProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [picked, setPicked] = useState<File[]>(initialFiles ?? []);
  const [step, setStep] = useState<ImportStep>(initialFiles?.length ? 'configure' : 'pick');
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocus[]>(DEFAULT_FOCUS);
  const maxWords = getMaxWords();
  const showTrainingFocus = isTrainingFocusApplicable(sheetType);

  useEffect(() => {
    if (!initialFiles?.length) return;
    setPicked(initialFiles);
    setStep('configure');
  }, [initialFiles]);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const { files: images, dropped } = clampImagesForImport(Array.from(list));
    if (images.length === 0) return;
    if (dropped > 0) {
      onToast?.(
        t('scanPhotosLimited', locale)
          .replace('{max}', String(getMaxImagesPerImport()))
          .replace('{dropped}', String(dropped)),
      );
    }
    setPicked(images);
    setStep('configure');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSheetTypeChange = (type: SheetType) => {
    onSheetTypeChange(type);
    if (!isTrainingFocusApplicable(type)) {
      setTrainingFocus(DEFAULT_FOCUS);
    }
  };

  const startScan = () => {
    if (picked.length === 0) return;
    const focus = showTrainingFocus ? trainingFocus : DEFAULT_FOCUS;
    onFile(picked.length === 1 ? picked[0] : picked, focus);
  };

  const handleBack = () => {
    if (step === 'configure') {
      setStep('pick');
      return;
    }
    onBack();
  };

  const screenTitle =
    step === 'configure' ? t('importConfigureTitle', locale) : t('importTitle', locale);

  return (
    <div
      className={`screen flow-screen import-screen${isDesktop ? ' import-screen--desktop' : ''}${step === 'configure' ? ' import-screen--configure' : ''}`}
    >
      <header className="top-bar">
        <button type="button" className="icon-btn" onClick={handleBack} aria-label={t('back', locale)}>
          ←
        </button>
        <h2 className="screen-title">{screenTitle}</h2>
        <span className="top-spacer" />
      </header>

      {step === 'pick' && (
        <main className="import-main scroll-natural">
          {importError && (
            <div className="import-error-banner" role="alert">
              {importError}
            </div>
          )}

          <p className="import-multi-hint">
            {t('importMultiHint', locale).replace('{max}', String(maxWords))}
          </p>

          {isDesktop && (
            <div
              className={`import-dropzone ${dragOver ? 'import-dropzone--active' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
              }}
            >
              <span className="import-dropzone-icon" aria-hidden="true">
                📄
              </span>
              <span className="import-dropzone-title">{t('importDrop', locale)}</span>
              <span className="import-dropzone-sub">{t('importDropOr', locale)}</span>
            </div>
          )}

          <button type="button" className="import-card import-card--primary" onClick={() => fileRef.current?.click()}>
            <span className="import-icon">🖼️</span>
            <span className="import-title">{t('importFile', locale)}</span>
            <span className="import-desc">
              {isDesktop ? t('importFileDescDesktop', locale) : t('importFileDesc', locale)}
            </span>
          </button>

          {!isDesktop && (
            <button type="button" className="import-card" onClick={() => cameraRef.current?.click()}>
              <span className="import-icon">📷</span>
              <span className="import-title">{t('importCamera', locale)}</span>
              <span className="import-desc">{t('importCameraDesc', locale)}</span>
            </button>
          )}
        </main>
      )}

      {step === 'configure' && (
        <main className="import-config-main scroll-natural">
          <BrandDecor />
          <div className="import-config-center premium-card">
            <span className="import-config-badge">
              {t('importPicked', locale).replace('{count}', String(picked.length))}
            </span>
            <h3 className="import-config-heading">{t('sheetTypeTitle', locale)}</h3>
            <p className="import-config-sub">{t('importConfigureSub', locale)}</p>

            <SheetTypePicker
              locale={locale}
              value={sheetType}
              onChange={handleSheetTypeChange}
              variant="premium"
            />

            {showTrainingFocus && (
              <TrainingFocusPicker locale={locale} value={trainingFocus} onChange={setTrainingFocus} />
            )}

            <p className="import-sheet-hint import-config-hint">{t(hintKeyForSheetType(sheetType), locale)}</p>

            <button type="button" className="btn-primary btn-lg import-scan-btn import-config-scan" onClick={startScan}>
              {t('importStart', locale)}
            </button>
          </div>
        </main>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleChange}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleChange}
      />
    </div>
  );
}
