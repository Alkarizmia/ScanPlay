import { useEffect, useRef } from 'react';
import { isMusicEnabled, subscribePreferences } from '../lib/preferences';
import {
  ensureBackgroundMusic,
  refreshMusicVolume,
  resolveBackgroundMusicMode,
  stopAllMusic,
} from '../lib/sounds';
import type { FlowScreen } from '../types';

export function syncAppMusic(flow: FlowScreen | null, examMode = false): void {
  ensureBackgroundMusic(resolveBackgroundMusicMode(flow, examMode));
}

export function useAppMusic(flow: FlowScreen | null, examMode = false): void {
  const flowRef = useRef(flow);
  const examRef = useRef(examMode);
  flowRef.current = flow;
  examRef.current = examMode;

  useEffect(() => {
    syncAppMusic(flow, examMode);
  }, [flow, examMode]);

  useEffect(() => {
    return subscribePreferences(() => {
      refreshMusicVolume();
      if (!isMusicEnabled()) {
        stopAllMusic();
        return;
      }
      syncAppMusic(flowRef.current, examRef.current);
    });
  }, []);
}
