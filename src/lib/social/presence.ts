import { getSupabase } from '../supabase';
import { isSocialAvailable } from './publicProfile';

/** En ligne si heartbeat reçu dans les 2 dernières minutes (intervalle heartbeat = 60 s). */
export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

const HIDDEN_OFFLINE_MS = 45_000;

export function isUserOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  const ts = Date.parse(lastSeenAt);
  if (!Number.isFinite(ts)) return false;
  const age = Date.now() - ts;
  if (age < 0) return false;
  return age < ONLINE_THRESHOLD_MS;
}

export async function touchPresence(): Promise<void> {
  if (!isSocialAvailable()) return;
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.rpc('touch_presence');
}

export async function clearPresence(): Promise<void> {
  if (!isSocialAvailable()) return;
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.rpc('clear_presence');
}

export function startPresenceHeartbeat(): () => void {
  void touchPresence();

  const intervalId = window.setInterval(() => {
    if (document.visibilityState === 'visible') void touchPresence();
  }, 60_000);

  let hiddenTimer: number | null = null;

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      if (hiddenTimer != null) {
        window.clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
      void touchPresence();
      return;
    }

    if (hiddenTimer != null) window.clearTimeout(hiddenTimer);
    hiddenTimer = window.setTimeout(() => {
      hiddenTimer = null;
      void clearPresence();
    }, HIDDEN_OFFLINE_MS);
  };

  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    window.clearInterval(intervalId);
    if (hiddenTimer != null) window.clearTimeout(hiddenTimer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
