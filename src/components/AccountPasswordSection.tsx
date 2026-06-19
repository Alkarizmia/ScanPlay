import { useEffect, useRef, useState } from 'react';
import { updatePassword } from '../lib/auth';
import { t, type TranslationKey } from '../lib/i18n';
import type { Locale } from '../types';

interface AccountPasswordSectionProps {
  locale: Locale;
  highlight?: boolean;
  onHighlightDone?: () => void;
}

export function AccountPasswordSection({
  locale,
  highlight = false,
  onHighlightDone,
}: AccountPasswordSectionProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [infoKey, setInfoKey] = useState<TranslationKey | null>(null);

  useEffect(() => {
    if (!highlight) return;
    blockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(() => onHighlightDone?.(), 8000);
    return () => window.clearTimeout(timer);
  }, [highlight, onHighlightDone]);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setErrorKey('authFillFields');
      setInfoKey(null);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorKey('passwordMismatch');
      setInfoKey(null);
      return;
    }

    setLoading(true);
    setErrorKey(null);
    setInfoKey(null);
    const result = await updatePassword(newPassword);
    setLoading(false);

    if (result.error) {
      setErrorKey(result.error as TranslationKey);
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    setInfoKey('passwordChanged');
    onHighlightDone?.();
  };

  return (
    <div
      ref={blockRef}
      className={`account-password-block${highlight ? ' account-password-block--highlight' : ''}`}
    >
      <h4 className="settings-sublabel">{t('changePasswordTitle', locale)}</h4>
      <p className="settings-hint">
        {highlight ? t('authRecoveryGoSettings', locale) : t('changePasswordHint', locale)}
      </p>

      {errorKey && (
        <p className="settings-form-error" role="alert">
          {t(errorKey, locale)}
        </p>
      )}
      {infoKey && (
        <p className="settings-form-info" role="status">
          {t(infoKey, locale)}
        </p>
      )}

      <label className="field-label">{t('newPassword', locale)}</label>
      <div className="field-password">
        <input
          type={showPass ? 'text' : 'password'}
          className="field-input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          disabled={loading}
          autoFocus={highlight}
        />
        <button
          type="button"
          className="pass-toggle"
          onClick={() => setShowPass((s) => !s)}
          aria-label={t('togglePassword', locale)}
        >
          {showPass ? '🙈' : '👁'}
        </button>
      </div>

      <label className="field-label">{t('confirmPassword', locale)}</label>
      <input
        type={showPass ? 'text' : 'password'}
        className="field-input"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
        disabled={loading}
      />

      <button
        type="button"
        className="btn-primary btn-sm account-password-btn"
        disabled={loading}
        onClick={() => void handleChangePassword()}
      >
        {t('changePasswordBtn', locale)}
      </button>
    </div>
  );
}
