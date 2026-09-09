/** Session-on-disk helpers with no Supabase import — safe for the public landing boot. */

function isAuthCallbackUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  const search = window.location.search;
  return (
    hash.includes('access_token=') ||
    hash.includes('refresh_token=') ||
    search.includes('code=') ||
    search.includes('type=recovery') ||
    hash.includes('type=recovery')
  );
}

function parseStoredSessionUser(raw: string | null): { id: string; email: string | null } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      user?: { id?: string; email?: string | null };
      currentSession?: { user?: { id?: string; email?: string | null } };
    };
    const user = parsed.user ?? parsed.currentSession?.user;
    if (!user?.id) return null;
    return { id: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
}

export function readStoredSessionUser(): { id: string; email: string | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = import.meta.env.VITE_SUPABASE_URL ?? '';
    const ref = url.match(/https?:\/\/([^.]+)\./)?.[1];
    if (ref) {
      const fromKey = parseStoredSessionUser(localStorage.getItem(`sb-${ref}-auth-token`));
      if (fromKey) return fromKey;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      const found = parseStoredSessionUser(localStorage.getItem(key));
      if (found) return found;
    }
  } catch {
    /* private mode / blocked storage */
  }
  return null;
}

/** True when a Supabase session is already on disk (or returning from OAuth). */
export function hasStoredAuthSession(): boolean {
  return Boolean(readStoredSessionUser()) || isAuthCallbackUrl();
}
