import type { CSSProperties } from 'react';
import { LearningFlow } from './LearningFlow';
import { ScanningBackground } from './ScanningBackground';
import { Logo } from './Logo';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface ScanningScreenProps {
  locale: Locale;
  progress: number;
  status: string;
}

export function ScanningScreen({ locale, progress, status }: ScanningScreenProps) {
  const pct = Math.min(100, Math.max(0, progress));
  const atEnd = pct >= 99;
  const runnerStyle: CSSProperties = atEnd
    ? { left: '100%', top: '50%', transform: 'translate(-100%, -50%)' }
    : { left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="screen scanning-screen flow-screen scanning-screen-branded">
      <ScanningBackground />

      <div className="scanning-content">
        <p className="scanning-status-wow">{status || t('scanning', locale)}</p>

        <div className="progress-stage">
          <div
            className="progress-track-wow"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="progress-fill-wow" style={{ width: `${pct}%` }}>
              <span className="progress-shimmer" aria-hidden="true" />
            </div>
            <div className="progress-runner" style={runnerStyle}>
              <Logo size={40} />
            </div>
          </div>
          <span className="progress-pct">{pct}%</span>
        </div>

        <LearningFlow active={atEnd ? 'game' : 'sheet'} locale={locale} compact />
      </div>
    </div>
  );
}
