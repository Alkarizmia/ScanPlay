import { getUserId } from '../auth';
import { getProfile, isDefaultDisplayName } from '../profile';

/** Shareable deep link: opens ScanPlay on that player's public profile preview. */
export function buildProfileShareUrl(displayName: string, origin = window.location.origin): string {
  const name = displayName.trim();
  const url = new URL(origin);
  url.searchParams.set('profile', name);
  return url.toString();
}

export function canSharePublicProfile(): boolean {
  const profile = getProfile();
  const userId = getUserId();
  if (!profile?.displayName?.trim()) return false;
  if (userId && isDefaultDisplayName(profile.displayName, userId)) return false;
  return true;
}

export async function sharePublicProfile(
  displayName: string,
  shareText: string,
): Promise<'shared' | 'copied' | 'failed' | 'need_name'> {
  const name = displayName.trim();
  if (!name) return 'need_name';
  const userId = getUserId();
  if (userId && isDefaultDisplayName(name, userId)) return 'need_name';

  const url = buildProfileShareUrl(name);
  const text = shareText.replace('{url}', url).replace('{name}', name);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'ScanPlay', text, url });
      return 'shared';
    } catch {
      /* cancelled or unsupported — fall through to clipboard */
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
