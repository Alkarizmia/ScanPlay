import { useEffect, useRef, type CSSProperties } from 'react';
import { ScanningBackground } from './ScanningBackground';
import { ScanPlayMascot } from './mascot/ScanPlayMascot';
import { getScanAdventureState, type ScanPixMood } from '../lib/scanAdventure';
import type { MascotExpression } from '../lib/mascot/types';
import { playSound } from '../lib/sounds';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface ScanningScreenProps {
  locale: Locale;
  progress: number;
  status: string;
}

function moodToExpression(mood: ScanPixMood): MascotExpression {
  switch (mood) {
    case 'running':
      return 'running';
    case 'thinking':
      return 'reading';
    case 'excited':
      return 'excited';
    default:
      return 'happy';
  }
}

function bubbleForProgress(locale: Locale, pct: number, status: string): string {
  const demo = t('demoLoading', locale);
  const reading = t('reading', locale);
  const scanningAi = t('scanningAi', locale);
  const scanning = t('scanning', locale);
  const building = t('building', locale);

  if (status === demo) return status;
  if (status === building || pct >= 92) return building;
  if (status !== reading && status !== scanningAi && status !== scanning) return status;
  if (pct < 40) return reading;
  if (pct < 80) return scanningAi;
  return building;
}

export function ScanningScreen({ locale, progress, status }: ScanningScreenProps) {
  const pct = Math.min(100, Math.max(0, progress));
  const adventure = getScanAdventureState(pct);
  const atEnd = pct >= 99;
  const lastBlipRef = useRef(0);

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

  const runnerStyle: CSSProperties = atEnd
    ? { left: '100%', transform: 'translate(-100%, -50%)' }
    : { left: `${Math.max(8, pct)}%`, transform: 'translate(-50%, -50%)' };

  const bubbleText = bubbleForProgress(locale, pct, status);
  const runnerExpression = moodToExpression(adventure.mood);

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
              className={`scanning-track-game${adventure.rocket ? ' scanning-track-game--boost' : ''}${atEnd ? ' scanning-track-game--finish' : ''}`}
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

              <div
                className={`scanning-track-runner${adventure.rocket && !atEnd ? ' scanning-track-runner--rocket' : ''}${atEnd ? ' scanning-track-runner--finish' : ''}`}
                style={runnerStyle}
                aria-hidden="true"
              >
                {adventure.rocket && !atEnd && (
                  <>
                    <span className="scanning-rocket-flame scanning-rocket-flame--1" />
                    <span className="scanning-rocket-flame scanning-rocket-flame--2" />
                    <span className="scanning-runner-glow" aria-hidden="true" />
                  </>
                )}
                <div className="scanning-track-mascot">
                  <ScanPlayMascot
                    expression={runnerExpression}
                    size={54}
                    idle={!adventure.rocket}
                    celebrate={atEnd}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
