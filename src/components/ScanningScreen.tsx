import { useEffect, useRef, type CSSProperties } from 'react';
import { LearningFlow } from './LearningFlow';
import { ScanningBackground } from './ScanningBackground';
import { PixCompanion } from './PixCompanion';
import { getScanAdventureState } from '../lib/scanAdventure';
import { playSound } from '../lib/sounds';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface ScanningScreenProps {
  locale: Locale;
  progress: number;
  status: string;
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

  const bubbleText = status || t('scanning', locale);

  return (
    <div className="screen scanning-screen flow-screen scanning-screen-branded scanning-screen-adventure">
      <ScanningBackground />

      <div className="scanning-content scanning-content-adventure">
        <div className="scanning-pix-hero">
          <PixCompanion mood={adventure.mood} size={96} animate />
          <div className="scanning-pix-bubble" role="status" aria-live="polite">
            <p className="scanning-pix-bubble-text">{bubbleText}</p>
          </div>
        </div>

        <p className="scanning-quest-label">{t('scanningQuestLabel', locale)}</p>

        <div className="scanning-track-wrap">
          <div
            className="scanning-track-game"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('scanningTrackLabel', locale)}
          >
            <div className="scanning-track-fill" style={{ width: `${pct}%` }}>
              <span className="scanning-track-shimmer" aria-hidden="true" />
              {pct > 18 && (
                <span className="scanning-track-label">{t('scanningTrackLabel', locale)}</span>
              )}
            </div>
            <div
              className={`scanning-track-runner${adventure.rocket && !atEnd ? ' scanning-track-runner--rocket' : ''}`}
              style={runnerStyle}
              aria-hidden="true"
            >
              {adventure.rocket && (
                <>
                  <span className="scanning-rocket-flame scanning-rocket-flame--1" />
                  <span className="scanning-rocket-flame scanning-rocket-flame--2" />
                </>
              )}
              <img
                src="/pix-adventure-run.png"
                alt=""
                className="scanning-pix-runner-img"
                width={52}
                height={52}
                draggable={false}
              />
            </div>
          </div>
          <p className="scanning-checkpoint">{t(adventure.checkpointKey, locale)}</p>
        </div>

        <LearningFlow active={atEnd ? 'game' : adventure.flowStep} locale={locale} compact />
      </div>
    </div>
  );
}
