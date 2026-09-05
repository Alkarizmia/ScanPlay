import { useEffect, useRef, useState } from 'react';

import { GuestScanBanner } from './GuestScanBanner';
import { BackIcon } from './icons/BackIcon';
import { SheetTypePicker } from './SheetTypePicker';
import { TrainingFocusPicker } from './TrainingFocusPicker';
import { collectDroppedImageFiles, isLikelyImageFile } from '../lib/droppedFiles';
import { clampImagesForImport, getMaxImagesPerImport } from '../lib/planLimits';
import { isLoggedIn } from '../lib/auth';
import { canGuestScan } from '../lib/guestTrial';
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
  onAuth?: () => void;
  showGuestBanner?: boolean;
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
  onAuth,
  showGuestBanner = false,
}: ImportScreenProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const appendNextPickRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const [picked, setPicked] = useState<File[]>(initialFiles ?? []);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [step, setStep] = useState<ImportStep>(initialFiles?.length ? 'photos' : 'pick');
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocus[]>(DEFAULT_FOCUS);
  const maxPhotos = getMaxImagesPerImport();
  const guestMode = !isLoggedIn();
  const guestTrial = guestMode && canGuestScan();
  const showTrainingFocus = isTrainingFocusApplicable(sheetType);
  const atPhotoLimit = picked.length >= maxPhotos;
  const allowMultiPick = maxPhotos > 1;

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

  const ingestFiles = (list: FileList | File[] | null, append: boolean) => {
    if (!list) return;
    const incoming = Array.from(list).filter(isLikelyImageFile);
    if (incoming.length === 0) return;

    const merged = append ? [...picked, ...incoming] : incoming;
    const { files: images, dropped } = clampImagesForImport(merged);
    if (images.length === 0) return;

    if (dropped > 0) {
      onToast?.(
        guestTrial
          ? t('guestScanSingleOnly', locale)
          : t('scanPhotosLimited', locale)
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const images = await collectDroppedImageFiles(e.dataTransfer);
    if (images.length === 0) {
      onToast?.(t('importDropNoImages', locale));
      return;
    }
    ingestFiles(images, false);
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
      className={`screen flow-screen import-screen${isDesktop ? ' import-screen--desktop' : ''}${step === 'pick' ? ' import-screen--pick' : ''}${step === 'configure' ? ' import-screen--configure' : ''}${step === 'photos' ? ' import-screen--photos' : ''}`}
    >
      {(step === 'pick' || step === 'configure') && (
        <div className="import-ambient" aria-hidden="true">
          <span className="import-ambient-orb import-ambient-orb--a" />
          <span className="import-ambient-orb import-ambient-orb--b" />
          <span className="import-ambient-orb import-ambient-orb--c" />
          <span className="import-ambient-sheen" />
        </div>
      )}

      <header className="top-bar">
        <button type="button" className="icon-btn" onClick={handleBack} aria-label={t('back', locale)}>
          <BackIcon />
        </button>
        <h2 className="screen-title">{screenTitle}</h2>
        <span className="top-spacer" />
      </header>

      {step === 'pick' && (
        <main className="import-main import-main--pick scroll-natural">
          {showGuestBanner && <GuestScanBanner locale={locale} onAuth={onAuth} compact />}

          {importError && (
            <div className="import-error-banner" role="alert">
              {importError}
            </div>
          )}

          {!isDesktop && (
            <div className="import-pick-actions">
              <button type="button" className="import-card import-card--primary" onClick={() => openCamera(false)}>
                <span className="import-icon" aria-hidden="true">
                  📸
                </span>
                <span className="import-title">{t('importCamera', locale)}</span>
                <span className="import-desc">{t('importCameraDesc', locale)}</span>
              </button>

              <button type="button" className="import-card" onClick={() => openFilePicker(false)}>
                <span className="import-icon" aria-hidden="true">
                  📁
                </span>
                <span className="import-title">{t('importFile', locale)}</span>
                <span className="import-desc">{t('importFileDesc', locale)}</span>
              </button>
            </div>
          )}

          {isDesktop && (
            <button
              type="button"
              className={`import-dropzone${dragOver ? ' import-dropzone--active' : ''}`}
              onClick={() => openFilePicker(false)}
              onDragEnter={handleDragOver}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => void handleDrop(e)}
            >
              <span className="import-dropzone-glow" aria-hidden="true" />
              <span className="import-dropzone-icon" aria-hidden="true">
                📄
              </span>
              <span className="import-dropzone-title">{t('importDrop', locale)}</span>
              <span className="import-dropzone-sub">{t('importDropOr', locale)}</span>
              <span className="import-frame-hint">{t('importFrameHint', locale)}</span>
            </button>
          )}
        </main>
      )}

      {step === 'photos' && (
        <main className="import-photos-main scroll-natural">
          {guestTrial && (
            <p className="import-photos-guest-hint" role="status">
              {t('importPhotosGuestOnly', locale)}
            </p>
          )}
          <p className="import-photos-sub">{t('importPhotosSub', locale)}</p>
          <p className="import-frame-hint">{t('importFrameHint', locale)}</p>
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
            <p className="import-photos-limit">
              {guestTrial
                ? t('importPhotosGuestOnly', locale)
                : t('importPhotosMax', locale).replace('{max}', String(maxPhotos))}
            </p>
          )}

          <div className="import-photos-actions">
            {allowMultiPick && !isDesktop && (
              <button
                type="button"
                className="btn-secondary import-photos-add"
                disabled={atPhotoLimit}
                onClick={() => openCamera(true)}
              >
                📷 {t('importPhotosAddCamera', locale)}
              </button>
            )}
            {allowMultiPick && (
              <button
                type="button"
                className="btn-secondary import-photos-add"
                disabled={atPhotoLimit}
                onClick={() => openFilePicker(true)}
              >
                🖼️ {t('importPhotosAddFile', locale)}
              </button>
            )}
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
          <div className="import-config-center">
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
        multiple={allowMultiPick}
        className="sr-only"
        onChange={handleInputChange}
      />
    </div>
  );
}
