/** Runtime scan client platform — never use account id / plan for image routing. */

export type ScanPlatform = 'ios' | 'android' | 'windows' | 'other';

/** Image-prepare channel — one path per device family (no Android+Windows mix). */
export type SheetPreparePath = 'ios' | 'android' | 'windows' | 'other';

/**
 * Detect from navigator UA / platform / touch only.
 * iPadOS 13+ often reports as Macintosh + touch — treat as iOS.
 */
export function getScanPlatform(
  nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> | null | undefined = typeof navigator !== 'undefined'
    ? navigator
    : null,
): ScanPlatform {
  if (!nav) return 'other';

  const ua = nav.userAgent || '';
  const platform = nav.platform || '';
  const maxTouchPoints = nav.maxTouchPoints || 0;

  const isIosUa = /iPhone|iPad|iPod/i.test(ua);
  const isIpadOsDesktopUa =
    /Macintosh|MacIntel/i.test(ua) && maxTouchPoints > 1;
  const isIosPlatform = /iPhone|iPad|iPod/i.test(platform);

  if (isIosUa || isIpadOsDesktopUa || isIosPlatform) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua) || /Win\d+/i.test(platform)) return 'windows';
  return 'other';
}

export function isIosScanClient(): boolean {
  return getScanPlatform() === 'ios';
}

/** Which prepare implementation `prepareSheetImage` will call. */
export function selectSheetPreparePath(
  platform: ScanPlatform = getScanPlatform(),
): SheetPreparePath {
  if (platform === 'ios') return 'ios';
  if (platform === 'android') return 'android';
  if (platform === 'windows') return 'windows';
  return 'other';
}
