import { useState } from 'react';
import { BackIcon } from './icons/BackIcon';
import { deleteAccount } from '../lib/accountDelete';
import { signOut } from '../lib/auth';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

const DELETE_CONFIRM_WORD = 'OK';

interface DeleteAccountScreenProps {
  locale: Locale;
  onBack: () => void;
  onDeleted: () => void;
}

export function DeleteAccountScreen({ locale, onBack, onDeleted }: DeleteAccountScreenProps) {
  const [confirmText, setConfirmText] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);

  const canContinue = confirmText.trim() === DELETE_CONFIRM_WORD && !working;

  const handleContinue = async () => {
    if (confirmText.trim() !== DELETE_CONFIRM_WORD || working) return;
    setWorking(true);
    setError(false);
    const result = await deleteAccount();
    if (!result.ok) {
      setWorking(false);
      setError(true);
      return;
    }
    try {
      await signOut();
    } catch {
      /* auth user already gone */
    }
    onDeleted();
  };

  return (
    <div className="screen tab-screen delete-account-screen">
      <header className="top-bar">
        <button
          type="button"
          className="icon-btn"
          onClick={onBack}
          aria-label={t('back', locale)}
          disabled={working}
        >
          <BackIcon />
        </button>
        <h2 className="screen-title">{t('deleteAccount', locale)}</h2>
        <span className="top-spacer" />
      </header>

      <main className="delete-account-main scroll-natural">
        <p className="delete-account-warning" role="alert">
          {t('deleteAccountWarning', locale)}
        </p>
        <p className="delete-account-body">{t('deleteAccountBody', locale)}</p>

        <label className="field-label" htmlFor="delete-account-ok">
          {t('deleteAccountTypeOk', locale)}
        </label>
        <input
          id="delete-account-ok"
          type="text"
          className="field-input delete-account-ok-input"
          value={confirmText}
          onChange={(e) => {
            setConfirmText(e.target.value);
            if (error) setError(false);
          }}
          placeholder={DELETE_CONFIRM_WORD}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={working}
          aria-required="true"
        />

        {error && <p className="auth-error">{t('deleteAccountError', locale)}</p>}

        <button
          type="button"
          className="btn-primary btn-lg delete-account-continue"
          onClick={() => void handleContinue()}
          disabled={!canContinue}
        >
          {working ? t('deleteAccountWorking', locale) : t('deleteAccountContinue', locale)}
        </button>
        <button
          type="button"
          className="btn-secondary btn-lg"
          onClick={onBack}
          disabled={working}
        >
          {t('deleteAccountKeep', locale)}
        </button>
      </main>
    </div>
  );
}
