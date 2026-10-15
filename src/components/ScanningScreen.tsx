import { useEffect, useRef, useState } from 'react';
import { ScanningBackground } from './ScanningBackground';
import { nextScanTalkOffset, scanTalkLine, scanTalkPhase } from '../lib/scanLoadingLines';
import { playSound } from '../lib/sounds';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface ScanningScreenProps {
  locale: Locale;
  progress: number;
  status: string;
  onCancel?: () => void;
}

export function ScanningScreen({ locale, progress, status, onCancel }: ScanningScreenProps) {
  const pct = Math.min(100, Math.max(0, progress));
  const atEnd = pct >= 99;
  const lastBlipRef = useRef(0);
  const offsetRef = useRef(nextScanTalkOffset());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((n) => n + 1);
    }, 4500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const milestones = [25, 50, 75, 99];
    for (const m of milestones) {
      if (pct >= m && lastBlipRef.current < m) {
        lastBlipRef.current = m;
        playSound(m >= 99 ? 'coinPop' : 'progressBlip');
        break;
      }
    }
  }, [pct]);

  const phase = scanTalkPhase(locale, pct, status);
  const bubbleText =
    phase === 'passthrough' ? status : scanTalkLine(locale, phase, offsetRef.current, tick);

  return (
    <div className="screen scanning-screen flow-screen scanning-screen-branded scanning-screen-adventure">
      <ScanningBackground />

      <div className="scanning-content scanning-content-adventure">
        <div className="scanning-adventure-stage">
          <div className="scanning-speech-bubble" role="status" aria-live="polite" key={bubbleText}>
            <p className="scanning-speech-text">{bubbleText}</p>
          </div>

          <div className="scanning-track-wrap">
            <div
              className={`scanning-track-game${atEnd ? ' scanning-track-game--finish' : ''}`}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('scanningTrackLabel', locale)}
            >
              <div className="scanning-track-fill" style={{ width: `${pct}%` }}>
                <span className="scanning-track-shimmer" aria-hidden="true" />
                {pct > 22 && (
                  <span className="scanning-track-label">{t('scanningTrackLabel', locale)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        {onCancel && (
          <button type="button" className="btn-ghost scanning-cancel" onClick={onCancel}>
            {t('scanCancel', locale)}
          </button>
        )}
      </div>
    </div>
  );
}
