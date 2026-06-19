export type DeviceKind = 'mobile' | 'desktop';

export interface DeviceProfile {
  kind: DeviceKind;
  isTouch: boolean;
  hasFinePointer: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

const DESKTOP_MIN_WIDTH = 768;

export function detectDeviceProfile(): DeviceProfile {
  if (typeof window === 'undefined') {
    return {
      kind: 'mobile',
      isTouch: false,
      hasFinePointer: false,
      viewportWidth: 0,
      viewportHeight: 0,
    };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  let kind: DeviceKind = 'mobile';

  if (viewportWidth >= DESKTOP_MIN_WIDTH && hasFinePointer && !coarsePointer) {
    kind = 'desktop';
  } else if (viewportWidth >= 1024 && !coarsePointer) {
    kind = 'desktop';
  }

  return {
    kind,
    isTouch,
    hasFinePointer,
    viewportWidth,
    viewportHeight,
  };
}

export function applyDeviceAttributes(profile: DeviceProfile) {
  document.documentElement.dataset.device = profile.kind;
  document.documentElement.dataset.touch = profile.isTouch ? 'true' : 'false';
}
