import { getSupabase } from './supabase';

export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'not_configured' };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, error: 'not_logged_in' };

  try {
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? 'delete_failed' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'network' };
  }
}
