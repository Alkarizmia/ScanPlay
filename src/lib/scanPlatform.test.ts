import { describe, expect, it } from 'vitest';
import { getScanPlatform, selectSheetPreparePath } from './scanPlatform';

function nav(
  userAgent: string,
  platform = '',
  maxTouchPoints = 0,
): Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> {
  return { userAgent, platform, maxTouchPoints };
}

describe('getScanPlatform', () => {
  it('detects iPhone as ios', () => {
    expect(
      getScanPlatform(
        nav('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5),
      ),
    ).toBe('ios');
  });

  it('detects Android', () => {
    expect(
      getScanPlatform(
        nav('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36', 'Linux armv8l', 5),
      ),
    ).toBe('android');
  });

  it('detects Windows', () => {
    expect(
      getScanPlatform(
        nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0),
      ),
    ).toBe('windows');
  });

  it('treats iPadOS desktop UA + touch as ios', () => {
    expect(
      getScanPlatform(
        nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5),
      ),
    ).toBe('ios');
  });

  it('returns other for plain Mac without touch', () => {
    expect(
      getScanPlatform(
        nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0),
      ),
    ).toBe('other');
  });
});

describe('selectSheetPreparePath', () => {
  it('keeps ios / android / windows on separate prepare channels', () => {
    expect(selectSheetPreparePath('ios')).toBe('ios');
    expect(selectSheetPreparePath('android')).toBe('android');
    expect(selectSheetPreparePath('windows')).toBe('windows');
    expect(selectSheetPreparePath('other')).toBe('other');
  });
});
