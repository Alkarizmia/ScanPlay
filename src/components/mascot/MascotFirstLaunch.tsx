import { useEffect, useState } from 'react';

import { MascotCoach } from './MascotCoach';
import { markMascotIntroSeen } from '../../lib/mascot/firstLaunch';
import { t } from '../../lib/i18n';
import type { Locale } from '../../types';

interface MascotFirstLaunchProps {
  locale: Locale;
  onDone: () => void;
}

const INTRO_MS = 4200;

export function MascotFirstLaunch({ locale, onDone }: MascotFirstLaunchProps) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setClosing(true);
      markMascotIntroSeen();
      window.setTimeout(onDone, 320);
    }, INTRO_MS);
    return () => window.clearTimeout(id);
  }, [onDone]);

  return (
    <div className={`mascot-first-launch${closing ? ' mascot-first-launch--out' : ''}`} role="dialog" aria-modal="true">
      <div className="mascot-first-launch-card">
        <MascotCoach
          expression="welcome"
          size={100}
          celebrate
          message={t('mascotIntroMessage', locale)}
          placement="card"
        />
        <p className="mascot-first-launch-sub">{t('mascotIntroSub', locale)}</p>
      </div>
    </div>
  );
}
