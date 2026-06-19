import { countFriends } from './friends';

const KEY = 'scanplay-friend-count';

export function getCachedFriendCount(): number {
  try {
    return parseInt(localStorage.getItem(KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function setCachedFriendCount(count: number): void {
  localStorage.setItem(KEY, String(Math.max(0, count)));
}

export async function refreshFriendCount(): Promise<number> {
  const count = await countFriends();
  setCachedFriendCount(count);
  return count;
}
