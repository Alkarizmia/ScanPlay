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
  it('detects iPhone', () => {
    expect(
      getScanPlatform(
        nav('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'),
      ),
    ).toBe('ios');
  });

  it('detects Android', () => {
    expect(
      getScanPlatform(
        nav('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'),
      ),
    ).toBe('android');
  });

  it('detects Windows desktop', () => {
    expect(
      getScanPlatform(
        nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', 'Win32'),
      ),
    ).toBe('windows');
  });

  it('detects iPadOS desktop UA (Mac + touch)', () => {
    expect(
      getScanPlatform(
        nav(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          'MacIntel',
          5,
        ),
      ),
    ).toBe('ios');
  });

  it('does not treat Mac desktop without touch as iOS', () => {
    expect(
      getScanPlatform(
        nav(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          'MacIntel',
          0,
        ),
      ),
    ).toBe('other');
  });
});

describe('selectSheetPreparePath', () => {
  it('routes only iOS to the iOS prepare fork', () => {
    expect(selectSheetPreparePath('ios')).toBe('ios');
    expect(selectSheetPreparePath('android')).toBe('proven');
    expect(selectSheetPreparePath('windows')).toBe('proven');
    expect(selectSheetPreparePath('other')).toBe('proven');
  });
});
