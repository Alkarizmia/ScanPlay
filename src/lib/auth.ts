import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { UserProfile } from '../types';
import { clearLocalUserData } from './localData';
import { ensureUserProfile, loadProfileRaw } from './profile';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { flushSync, syncAfterLogin, syncOnSessionRestore } from './sync';

let cachedUser: UserProfile = { email: null, isLoggedIn: false };
let cachedUserId: string | null = null;
let authReady = false;
let authReadyResolvers: Array<() => void> = [];

function setCache(session: Session | null): void {
  const nextId = session?.user?.id ?? null;
  if (cachedUserId && nextId && cachedUserId !== nextId) {
    void import('./planLimits').then((m) => m.clearPlanState());
  }
  const localProfile = session?.user ? loadProfileRaw() : null;
  cachedUser = {
    email: session?.user?.email ?? null,
    isLoggedIn: Boolean(session?.user),
    displayName: localProfile?.displayName,
    avatar: localProfile?.avatar,
    customAvatarData: localProfile?.customAvatarData,
  };
  cachedUserId = nextId;
  void import('./planLimits').then((m) => m.setPlanUserId(nextId));
}

export function refreshProfileCacheFromProfile(): void {
  if (!cachedUser.isLoggedIn) return;
  const localProfile = loadProfileRaw();
  if (!localProfile) return;
  cachedUser = {
    ...cachedUser,
    displayName: localProfile.displayName,
    avatar: localProfile.avatar,
    customAvatarData: localProfile.customAvatarData,
  };
}

export function getUser(): UserProfile {
  return cachedUser;
}

export function getUserId(): string | null {
  return cachedUserId;
}

export function isLoggedIn(): boolean {
  return cachedUser.isLoggedIn;
}

export function isAuthReady(): boolean {
  return authReady;
}

export function waitForAuth(): Promise<void> {
  if (authReady) return Promise.resolve();
  return new Promise((resolve) => {
    authReadyResolvers.push(resolve);
  });
}

function markAuthReady(): void {
  authReady = true;
  authReadyResolvers.forEach((r) => r());
  authReadyResolvers = [];
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    }),
  ]);
}

let postAuthRunning = false;
let skipNextSignedInSync = false;
let passwordRecoveryPending = false;

type PasswordRecoveryListener = () => void;
const passwordRecoveryListeners = new Set<PasswordRecoveryListener>();

export function onPasswordRecovery(listener: PasswordRecoveryListener): () => void {
  passwordRecoveryListeners.add(listener);
  return () => {
    passwordRecoveryListeners.delete(listener);
  };
}

export function consumePasswordRecoveryPending(): boolean {
  const pending = passwordRecoveryPending;
  passwordRecoveryPending = false;
  return pending;
}

function notifyPasswordRecovery(): void {
  passwordRecoveryListeners.forEach((fn) => fn());
}

function isPasswordRecoveryUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  const search = new URLSearchParams(window.location.search);
  return hash.includes('type=recovery') || search.get('type') === 'recovery';
}

/** Defer so signInWithPassword can release the auth lock first (avoids Supabase deadlock). */
function deferPostAuth(session: Session, freshLogin: boolean): void {
  setTimeout(() => runPostAuth(session, freshLogin), 100);
}

/** Profile + cloud sync — never blocks the login button. */
function runPostAuth(session: Session, freshLogin: boolean): void {
  if (postAuthRunning) return;
  postAuthRunning = true;

  void (async () => {
    try {
      if (freshLogin) {
        await syncAfterLogin();
      } else {
        await syncOnSessionRestore();
      }
      await ensureProfileDb(session.user.id);
      if (!loadProfileRaw()?.displayName) {
        ensureUserProfile(session.user.id);
      }
      const { syncPublicProfileResolvingConflicts } = await import('./social/publicProfile');
      await syncPublicProfileResolvingConflicts();
      refreshProfileCacheFromProfile();
      void import('./social/presence').then((m) => m.touchPresence()).catch(() => {});
    } catch {
      /* offline or slow Supabase — login still succeeds */
    } finally {
      postAuthRunning = false;
    }
  })();
}

export async function initAuth(onChange?: () => void): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    markAuthReady();
    return;
  }

  const { data } = await supabase.auth.getSession();
  setCache(data.session);

  const recoveryFromUrl = isPasswordRecoveryUrl();
  if (data.session && recoveryFromUrl) {
    passwordRecoveryPending = true;
  }

  // OAuth / email links leave tokens in the URL — clean up once Supabase parsed them.
  const hash = window.location.hash;
  const search = window.location.search;
  if (
    hash.includes('access_token=') ||
    hash.includes('error=') ||
    search.includes('code=') ||
    search.includes('error=')
  ) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  if (!data.session) {
    clearLocalUserData();
  } else {
    skipNextSignedInSync = true;
    deferPostAuth(data.session, false);
    if (passwordRecoveryPending) {
      notifyPasswordRecovery();
    }
  }

  supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
    setCache(session);
    if (event === 'SIGNED_OUT') {
      clearLocalUserData();
      passwordRecoveryPending = false;
    }
    if (event === 'PASSWORD_RECOVERY' && session) {
      passwordRecoveryPending = true;
      skipNextSignedInSync = true;
      deferPostAuth(session, true);
      notifyPasswordRecovery();
      onChange?.();
      return;
    }
    if (event === 'INITIAL_SESSION' && session) {
      skipNextSignedInSync = true;
    }
    if (event === 'SIGNED_IN' && session) {
      if (skipNextSignedInSync) {
        skipNextSignedInSync = false;
      } else {
        deferPostAuth(session, true);
      }
    }
    onChange?.();
  });

  markAuthReady();
  onChange?.();
}

export type AuthResult = {
  error: string | null;
  errorDetail?: string;
  needsEmailConfirmation?: boolean;
};

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'authNotConfigured' };

  if (password.length < 6) {
    return { error: 'authWeakPassword' };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });

    if (error) {
      return { error: mapAuthError(error.message), errorDetail: error.message };
    }

    // Supabase renvoie un user vide si l'email existe déjà (sécurité)
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      return { error: 'authEmailTaken' };
    }

    // Ne jamais entrer dans l'app juste après inscription : validation email d'abord.
    // (Supabase peut renvoyer une session si auto-confirm SQL ou Confirm email OFF.)
    if (data.session) {
      await supabase.auth.signOut();
    }

    if (data.user) {
      return { error: null, needsEmailConfirmation: true };
    }

    return { error: 'authGenericError', errorDetail: 'No user returned' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: mapAuthError(msg), errorDetail: msg };
  }
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'authNotConfigured' };

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      return { error: mapAuthError(error.message), errorDetail: error.message };
    }
    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: mapAuthError(msg), errorDetail: msg };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'authNotConfigured' };

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return { error: mapAuthError(error.message), errorDetail: error.message };
    }
    if (!data.session) {
      return { error: 'authGenericError', errorDetail: 'No session returned' };
    }
    setCache(data.session);
    skipNextSignedInSync = true;
    deferPostAuth(data.session, true);
    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: mapAuthError(msg), errorDetail: msg };
  }
}

async function ensureProfileDb(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { error: rpcError } = await withTimeout(
      supabase.rpc('ensure_scanplay_profile'),
      8000,
      'ensure_scanplay_profile',
    );
    if (!rpcError) return;
  } catch {
    /* fall through to direct upsert */
  }

  try {
    await withTimeout(
      Promise.all([
        supabase.from('scanplay_profiles').upsert({
          user_id: userId,
          updated_at: new Date().toISOString(),
        }),
        supabase.from('scanplay_user_stats').upsert({
          user_id: userId,
          data: {},
          updated_at: new Date().toISOString(),
        }),
      ]),
      8000,
      'ensure_profile_upsert',
    );
  } catch {
    /* offline */
  }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    await import('./social/presence')
      .then((m) => m.clearPresence())
      .catch(() => {});
    await supabase.auth.signOut();
  }
  const { clearPlanState } = await import('./planLimits');
  clearPlanState();
  clearLocalUserData();
  setCache(null);
}

export async function resetPassword(
  email: string,
): Promise<{ error: string | null; errorDetail?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'authNotConfigured' };

  const redirectTo = `${window.location.origin}/`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) return { error: mapAuthError(error.message), errorDetail: error.message };
  return { error: null };
}

export async function updatePassword(
  newPassword: string,
): Promise<{ error: string | null; errorDetail?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'authNotConfigured' };
  if (!isLoggedIn()) return { error: 'authNotConfigured' };
  if (newPassword.length < 6) return { error: 'authWeakPassword' };

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: mapAuthError(error.message), errorDetail: error.message };
    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: mapAuthError(msg), errorDetail: msg };
  }
}

export async function resendSignupConfirmation(
  email: string,
): Promise<{ error: string | null; errorDetail?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'authNotConfigured' };

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
  if (error) return { error: mapAuthError(error.message), errorDetail: error.message };
  return { error: null };
}

export function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'authInvalidCredentials';
  }
  if (lower.includes('email not confirmed')) return 'authEmailNotConfirmed';
  if (
    lower.includes('already registered') ||
    lower.includes('already been registered') ||
    lower.includes('user already registered')
  ) {
    return 'authEmailTaken';
  }
  if (lower.includes('password') && (lower.includes('least') || lower.includes('short'))) {
    return 'authWeakPassword';
  }
  if (lower.includes('valid email') || lower.includes('invalid email')) return 'authInvalidEmail';
  if (lower.includes('signup') && lower.includes('disabled')) return 'authSignupDisabled';
  if (lower.includes('rate limit') || lower.includes('too many')) return 'authRateLimit';
  if (lower.includes('database error saving new user')) return 'authDatabaseError';
  if (lower.includes('timeout') || lower.includes('network') || lower.includes('fetch')) {
    return 'authNetworkTimeout';
  }
  if (lower.includes('confirmation email') || lower.includes('error sending')) {
    return 'authEmailSendError';
  }
  return 'authGenericError';
}

/** @deprecated use signIn */
export function login(email: string, password: string): UserProfile {
  void signIn(email, password);
  return cachedUser;
}

/** @deprecated use signUp */
export function signup(email: string, password: string): UserProfile {
  void signUp(email, password);
  return cachedUser;
}

/** @deprecated use signOut */
export function logout(): void {
  void signOut();
}

export function setupSyncLifecycle(): () => void {
  const flush = () => flushSync();
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
  return () => {
    window.removeEventListener('visibilitychange', flush);
    window.removeEventListener('pagehide', flush);
  };
}

export function isSupabaseEnabled(): boolean {
  return isSupabaseConfigured;
}
