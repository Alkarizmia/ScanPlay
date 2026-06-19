import { useEffect, useState } from 'react';
import { applyDeviceAttributes, detectDeviceProfile, type DeviceProfile } from '../lib/device';

export function useDeviceProfile(): DeviceProfile {
  const [profile, setProfile] = useState<DeviceProfile>(() => detectDeviceProfile());

  useEffect(() => {
    const update = () => {
      const next = detectDeviceProfile();
      setProfile(next);
      applyDeviceAttributes(next);
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return profile;
}
