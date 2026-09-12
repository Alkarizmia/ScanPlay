import { getSupabase } from './supabase';
import { clearAccountLocalData } from './localData';

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
      return { ok: false, error: 'delete_failed' };
    }
    clearAccountLocalData();
    return { ok: true };
  } catch {
    return { ok: false, error: 'network' };
  }
}
