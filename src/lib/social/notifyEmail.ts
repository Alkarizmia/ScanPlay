import { getSupabase } from '../supabase';

export async function notifyLifecycleEmail(payload: {
  kind: 'friend_request' | 'friend_accepted';
  otherUserId: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;

  try {
    await fetch('/api/notify-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    /* cron will retry social emails */
  }
}
