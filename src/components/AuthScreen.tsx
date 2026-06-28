import { useState } from 'react';
import { LogoWordmark } from './Logo';
import { SiteFooter } from './SiteFooter';
import {
  isSupabaseEnabled,
  resetPassword,
  resendSignupConfirmation,
  signIn,
  signInWithGoogle,
  signUp,
} from '../lib/auth';
import { t, type TranslationKey } from '../lib/i18n';
import type { Locale } from '../types';

type AuthMode = 'login' | 'signup' | 'forgot';

interface AuthScreenProps {
  locale: Locale;
  onSuccess: () => void;
  onBack?: () => void;
  variant?: 'default' | 'action';
  guestTrialUsed?: boolean;
}

export function AuthScreen({ locale, onSuccess, onBack, variant = 'default', guestTrialUsed = false }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [infoKey, setInfoKey] = useState<TranslationKey | null>(null);
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setErrorKey(null);
    setErrorDetail(null);
    setInfoKey(null);
    setAwaitingEmailConfirm(false);
    setResetEmailSent(false);
  };

  const subtitleKey =
    mode === 'forgot'
      ? 'authForgotSubtitle'
      : mode === 'signup'
        ? 'authSignupSubtitle'
        : guestTrialUsed
          ? 'guestAuthSubtitle'
          : variant === 'action'
            ? 'authActionSubtitle'
            : 'authLoginSubtitle';

  const runAuth = async () => {
    if (!email.trim() || !password) {
      setErrorKey('authFillFields');
      setErrorDetail(null);
      return;
    }
    setLoading(true);
    setErrorKey(null);
    setErrorDetail(null);
    setInfoKey(null);
    setResetEmailSent(false);
    try {
      const result =
        mode === 'login'
          ? await signIn(email.trim(), password)
          : await signUp(email.trim(), password);

      if (result.error) {
        setErrorKey(result.error as TranslationKey);
        setErrorDetail(result.errorDetail ?? null);
        return;
      }
      if (result.needsEmailConfirmation) {
        setAwaitingEmailConfirm(true);
        setInfoKey('authConfirmEmail');
        return;
      }
      if (mode === 'signup') {
        setInfoKey('authSignupSuccess');
      }
      onSuccess();
    } catch (e) {
      setErrorKey('authGenericError');
      setErrorDetail(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'forgot') {
      void handleForgot();
      return;
    }
    void runAuth();
  };

  const openForgot = () => {
    setErrorKey(null);
    setErrorDetail(null);
    setInfoKey(null);
    setResetEmailSent(false);
    setMode('forgot');
  };

  const handleForgot = async () => {
    if (!email.trim()) {
      setErrorKey('authEmailRequired');
      return;
    }
    setLoading(true);
    setErrorKey(null);
    setInfoKey(null);
    const result = await resetPassword(email.trim());
    setLoading(false);
    if (result.error) {
      setErrorKey(result.error as TranslationKey);
      setErrorDetail(result.errorDetail ?? null);
      return;
    }
    setResetEmailSent(true);
    setInfoKey('authResetSent');
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorKey(null);
    setErrorDetail(null);
    setInfoKey(null);
    try {
      const result = await signInWithGoogle();
      if (result.error) {
        setErrorKey(result.error as TranslationKey);
        setErrorDetail(result.errorDetail ?? null);
      }
      /* redirecting to Google — onSuccess runs after callback */
    } catch (e) {
      setErrorKey('authGenericError');
      setErrorDetail(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirm = async () => {
    if (!email.trim()) {
      setErrorKey('authEmailRequired');
      return;
    }
    setLoading(true);
    setErrorKey(null);
    const result = await resendSignupConfirmation(email.trim());
    setLoading(false);
    if (result.error) {
      setErrorKey(result.error as TranslationKey);
      setErrorDetail(result.errorDetail ?? null);
      return;
    }
    setInfoKey('authResendSent');
  };

  const showErrorDetail =
    errorDetail &&
    (errorKey === 'authGenericError' ||
      errorKey === 'authEmailSendError' ||
      errorKey === 'authNetworkTimeout' ||
      errorKey === 'authEmailNotConfirmed' ||
      errorKey === 'authInvalidCredentials');

  const showForgotFooter = mode === 'login' && !awaitingEmailConfirm;
  const showInvalidCredentialsHint = mode === 'login' && errorKey === 'authInvalidCredentials';

  return (
    <div className="screen flow-screen auth-screen">
      <header className="top-bar">
        {onBack ? (
          <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back', locale)}>
            ←
          </button>
        ) : (
          <LogoWordmark />
        )}
        <span className="top-spacer" />
      </header>

      <main className="auth-main scroll-natural">
        <h2 className="auth-title">
          {mode === 'forgot' ? t('authForgotTitle', locale) : t('authWelcome', locale)}
        </h2>

        {mode !== 'forgot' && (
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
              disabled={loading}
            >
              {t('login', locale)}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => switchMode('signup')}
              disabled={loading}
            >
              {t('signup', locale)}
            </button>
          </div>
        )}

        <p className="auth-sub">{t(subtitleKey, locale)}</p>

        {errorKey && (
          <div className="auth-error-block" role="alert">
            <p className="auth-error">
              {t(errorKey, locale)}
              {showErrorDetail && <span className="auth-error-detail"> ({errorDetail})</span>}
            </p>
            {showInvalidCredentialsHint && (
              <p className="auth-forgot-hint">{t('authForgotAfterError', locale)}</p>
            )}
          </div>
        )}
        {awaitingEmailConfirm ? (
          <div className="auth-confirm-panel" role="status">
            <p className="auth-info">{t('authConfirmEmail', locale)}</p>
            <p className="auth-confirm-hint">{t('authConfirmEmailHint', locale)}</p>
            <p className="auth-confirm-email">
              <strong>{email.trim()}</strong>
            </p>
            <button
              type="button"
              className="btn-secondary auth-resend"
              onClick={() => void handleResendConfirm()}
              disabled={loading}
            >
              {t('authResendConfirm', locale)}
            </button>
            <button
              type="button"
              className="btn-primary btn-lg auth-confirm-login"
              onClick={() => switchMode('login')}
              disabled={loading}
            >
              {t('authConfirmGoLogin', locale)}
            </button>
          </div>
        ) : (
          resetEmailSent ? (
            <div className="auth-reset-panel" role="status">
              <p className="auth-info">{t('authResetSent', locale)}</p>
              <p className="auth-reset-hint">{t('authResetSentHint', locale)}</p>
              <p className="auth-confirm-email">
                <strong>{email.trim()}</strong>
              </p>
              <button
                type="button"
                className="btn-secondary auth-resend"
                onClick={() => void handleForgot()}
                disabled={loading}
              >
                {t('authForgotResend', locale)}
              </button>
              <button
                type="button"
                className="btn-primary btn-lg auth-confirm-login"
                onClick={() => switchMode('login')}
                disabled={loading}
              >
                {t('authForgotBackLogin', locale)}
              </button>
            </div>
          ) : (
            infoKey && (
              <p className="auth-info" role="status">
                {t(infoKey, locale)}
              </p>
            )
          )
        )}

        {!awaitingEmailConfirm && !resetEmailSent && isSupabaseEnabled() && mode !== 'forgot' && (
          <>
            <button
              type="button"
              className="auth-google-btn"
              onClick={() => void handleGoogleSignIn()}
              disabled={loading}
            >
              <svg className="auth-google-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t('authContinueGoogle', locale)}
            </button>
            <div className="auth-divider" aria-hidden="true">
              <span>{t('or', locale)}</span>
            </div>
          </>
        )}

        {!awaitingEmailConfirm && !resetEmailSent && (
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field-label">{t('email', locale)}</label>
          <input
            type="email"
            className="field-input"
            placeholder={t('authEmailPlaceholder', locale)}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />

          {mode !== 'forgot' && (
            <>
              <label className="field-label">{t('password', locale)}</label>
              <div className="field-password">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="field-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="pass-toggle"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label="Toggle password"
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </>
          )}

          {mode === 'signup' && (
            <p className="auth-hint">{t('authSignupHint', locale)}</p>
          )}

          <button type="submit" className="btn-primary btn-lg" disabled={loading}>
            {loading
              ? t('authLoading', locale)
              : mode === 'forgot'
                ? t('authForgotSend', locale)
                : mode === 'login'
                  ? t('login', locale)
                  : t('signup', locale)}
          </button>

          {mode === 'forgot' && (
            <button
              type="button"
              className="btn-ghost auth-forgot-back"
              onClick={() => switchMode('login')}
              disabled={loading}
            >
              {t('authForgotBackLogin', locale)}
            </button>
          )}
        </form>
        )}

        {showForgotFooter && !resetEmailSent && (
          <div className="auth-forgot-footer">
            <button
              type="button"
              className="text-link auth-forgot"
              onClick={openForgot}
              disabled={loading}
            >
              {t('forgotPassword', locale)}
            </button>
          </div>
        )}

        {onBack && !awaitingEmailConfirm && !resetEmailSent && mode !== 'forgot' && (
          <button type="button" className="btn-ghost" onClick={onBack} disabled={loading}>
            {t('back', locale)}
          </button>
        )}
        <SiteFooter locale={locale} />
      </main>
    </div>
  );
}
