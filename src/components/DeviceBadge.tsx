import { t } from '../lib/i18n';
import type { DeviceKind, DeviceProfile } from '../lib/device';
import type { Locale } from '../types';

interface DeviceBadgeProps {
  locale: Locale;
  profile: DeviceProfile;
  compact?: boolean;
}

export function DeviceBadge({ locale, profile, compact = false }: DeviceBadgeProps) {
  const label = profile.kind === 'desktop' ? t('deviceDesktop', locale) : t('deviceMobile', locale);
  const icon = profile.kind === 'desktop' ? '💻' : '📱';

  return (
    <span
      className={`device-badge device-badge--${profile.kind}${compact ? ' device-badge--compact' : ''}`}
      title={label}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

export function deviceClass(kind: DeviceKind) {
  return `device-${kind}`;
}
