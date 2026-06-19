import { useEffect, useRef } from 'react';
import type { FlowScreen, GameMode, TabId } from '../types';

export interface AppNavSnapshot {
  tab: TabId;
  flow: FlowScreen | null;
  mode: GameMode | null;
}

let replaceNextNav = false;

/** Replace current history entry instead of pushing (e.g. scanning → parcours). */
export function markNavReplace() {
  replaceNextNav = true;
}

export function appGoBack() {
  window.history.back();
}

interface UseAppNavigationHistoryOptions {
  onModalBack?: () => boolean;
}

export function useAppNavigationHistory(
  snapshot: AppNavSnapshot,
  applySnapshot: (snapshot: AppNavSnapshot) => void,
  options: UseAppNavigationHistoryOptions = {},
) {
  const skipPush = useRef(false);
  const initialized = useRef(false);
  const snapshotRef = useRef(snapshot);
  const onModalBackRef = useRef(options.onModalBack);
  snapshotRef.current = snapshot;
  onModalBackRef.current = options.onModalBack;

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (!window.history.state?.scanplay) {
      window.history.replaceState({ scanplay: snapshot }, '', window.location.href);
    }
  }, [snapshot]);

  useEffect(() => {
    if (skipPush.current) {
      skipPush.current = false;
      return;
    }

    const prev = window.history.state?.scanplay as AppNavSnapshot | undefined;
    if (
      prev &&
      prev.tab === snapshot.tab &&
      prev.flow === snapshot.flow &&
      prev.mode === snapshot.mode
    ) {
      return;
    }

    if (replaceNextNav) {
      replaceNextNav = false;
      window.history.replaceState({ scanplay: snapshot }, '', window.location.href);
      return;
    }

    window.history.pushState({ scanplay: snapshot }, '', window.location.href);
  }, [snapshot.tab, snapshot.flow, snapshot.mode]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      if (onModalBackRef.current?.()) {
        skipPush.current = true;
        window.history.pushState({ scanplay: snapshotRef.current }, '', window.location.href);
        return;
      }

      const next = event.state?.scanplay as AppNavSnapshot | undefined;
      if (next) {
        skipPush.current = true;
        applySnapshot(next);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applySnapshot]);
}
