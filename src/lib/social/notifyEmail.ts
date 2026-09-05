import { getSupabase } from '../supabase';

export async function notifyLifecycleEmail(payload: {
  kind: 'friend_request' | 'friend_accepted' | 'test';
  otherUserId?: string;
}): Promise<{ ok: boolean; to?: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false };

  try {
    const res = await fetch('/api/lifecycle-emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; to?: string | null };
    return { ok: Boolean(res.ok && json.ok), to: json.to };
  } catch {
    return { ok: false };
  }
}
