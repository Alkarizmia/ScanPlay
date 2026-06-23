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

type ImportStep = 'pick' | 'photos' | 'configure';

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
  const appendNextPickRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const [picked, setPicked] = useState<File[]>(initialFiles ?? []);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [step, setStep] = useState<ImportStep>(initialFiles?.length ? 'photos' : 'pick');
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocus[]>(DEFAULT_FOCUS);
  const maxWords = getMaxWords();
  const maxPhotos = getMaxImagesPerImport();
  const showTrainingFocus = isTrainingFocusApplicable(sheetType);
  const atPhotoLimit = picked.length >= maxPhotos;

  useEffect(() => {
    if (!initialFiles?.length) return;
    setPicked(initialFiles);
    setStep('photos');
  }, [initialFiles]);

  useEffect(() => {
    const urls = picked.map((file) => URL.createObjectURL(file));
    setPhotoUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [picked]);

  const ingestFiles = (list: FileList | null, append: boolean) => {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.type.startsWith('image/'));
    if (incoming.length === 0) return;

    const merged = append ? [...picked, ...incoming] : incoming;
    const { files: images, dropped } = clampImagesForImport(merged);
    if (images.length === 0) return;

    if (dropped > 0) {
      onToast?.(
        t('scanPhotosLimited', locale)
          .replace('{max}', String(maxPhotos))
          .replace('{dropped}', String(dropped)),
      );
    }

    setPicked(images);
    setStep('photos');
  };

  const openCamera = (append: boolean) => {
    appendNextPickRef.current = append;
    cameraRef.current?.click();
  };

  const openFilePicker = (append: boolean) => {
    appendNextPickRef.current = append;
    fileRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    ingestFiles(e.target.files, appendNextPickRef.current);
    appendNextPickRef.current = false;
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    ingestFiles(e.dataTransfer.files, false);
  };

  const removePhoto = (index: number) => {
    setPicked((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setStep('pick');
      return next;
    });
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
      setStep('photos');
      return;
    }
    if (step === 'photos') {
      setPicked([]);
      setStep('pick');
      return;
    }
    onBack();
  };

  const screenTitle =
    step === 'configure'
      ? t('importConfigureTitle', locale)
      : step === 'photos'
        ? t('importPhotosTitle', locale)
        : t('importTitle', locale);

  return (
    <div
      className={`screen flow-screen import-screen${isDesktop ? ' import-screen--desktop' : ''}${step === 'configure' ? ' import-screen--configure' : ''}${step === 'photos' ? ' import-screen--photos' : ''}`}
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
              onClick={() => openFilePicker(false)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') openFilePicker(false);
              }}
            >
              <span className="import-dropzone-icon" aria-hidden="true">
                📄
              </span>
              <span className="import-dropzone-title">{t('importDrop', locale)}</span>
              <span className="import-dropzone-sub">{t('importDropOr', locale)}</span>
            </div>
          )}

          <button type="button" className="import-card import-card--primary" onClick={() => openFilePicker(false)}>
            <span className="import-icon">🖼️</span>
            <span className="import-title">{t('importFile', locale)}</span>
            <span className="import-desc">
              {isDesktop ? t('importFileDescDesktop', locale) : t('importFileDesc', locale)}
            </span>
          </button>

          {!isDesktop && (
            <button type="button" className="import-card" onClick={() => openCamera(false)}>
              <span className="import-icon">📷</span>
              <span className="import-title">{t('importCamera', locale)}</span>
              <span className="import-desc">{t('importCameraDesc', locale)}</span>
            </button>
          )}
        </main>
      )}

      {step === 'photos' && (
        <main className="import-photos-main scroll-natural">
          <p className="import-photos-sub">{t('importPhotosSub', locale)}</p>
          <span className="import-config-badge import-photos-badge">
            {t('importPicked', locale).replace('{count}', String(picked.length))}
          </span>

          <ul className="import-photo-grid" aria-label={t('importPicked', locale).replace('{count}', String(picked.length))}>
            {picked.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}-${index}`} className="import-photo-item">
                {photoUrls[index] ? (
                  <img src={photoUrls[index]} alt="" className="import-photo-thumb" />
                ) : (
                  <div className="import-photo-thumb import-photo-thumb--placeholder" aria-hidden="true">
                    📷
                  </div>
                )}
                <button
                  type="button"
                  className="import-photo-remove icon-btn"
                  onClick={() => removePhoto(index)}
                  aria-label={t('importPhotosRemove', locale)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {atPhotoLimit && (
            <p className="import-photos-limit">{t('importPhotosMax', locale).replace('{max}', String(maxPhotos))}</p>
          )}

          <div className="import-photos-actions">
            {!isDesktop && (
              <button
                type="button"
                className="btn-secondary import-photos-add"
                disabled={atPhotoLimit}
                onClick={() => openCamera(true)}
              >
                📷 {t('importPhotosAddCamera', locale)}
              </button>
            )}
            <button
              type="button"
              className="btn-secondary import-photos-add"
              disabled={atPhotoLimit}
              onClick={() => openFilePicker(true)}
            >
              🖼️ {t('importPhotosAddFile', locale)}
            </button>
            <button
              type="button"
              className="btn-primary btn-lg import-photos-continue"
              disabled={picked.length === 0}
              onClick={() => setStep('configure')}
            >
              {t('importPhotosContinue', locale)}
            </button>
          </div>
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
        onChange={handleInputChange}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleInputChange}
      />
    </div>
  );
}
