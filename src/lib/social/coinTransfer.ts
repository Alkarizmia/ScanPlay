import { getUserId } from '../auth';
import { flushSync } from '../sync';
import { getSupabase } from '../supabase';
import { getCoins, spendCoins } from '../wallet';
import { isSocialAvailable } from './publicProfile';

export type TransferResult =
  | { ok: true }
  | { ok: false; reason: 'insufficient' | 'not_logged_in' | 'invalid' | 'not_friends' | 'network' };

export async function sendCoinsToFriend(targetUserId: string, amount: number): Promise<TransferResult> {
  if (!isSocialAvailable()) return { ok: false, reason: 'not_logged_in' };
  if (amount < 1 || amount > 9999) return { ok: false, reason: 'invalid' };
  if (targetUserId === getUserId()) return { ok: false, reason: 'invalid' };
  if (getCoins() < amount) return { ok: false, reason: 'insufficient' };

  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: 'network' };

  flushSync();

  const { error } = await supabase.rpc('transfer_coins_to_friend', {
    p_target: targetUserId,
    p_amount: amount,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('not friends')) return { ok: false, reason: 'not_friends' };
    if (msg.includes('insufficient')) return { ok: false, reason: 'insufficient' };
    return { ok: false, reason: 'network' };
  }

  const spent = spendCoins(amount);
  if (!spent.ok) return { ok: false, reason: spent.reason === 'insufficient' ? 'insufficient' : 'not_logged_in' };

  return { ok: true };
}
