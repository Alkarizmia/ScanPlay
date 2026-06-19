import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AchievementUnlockModal } from './components/AchievementUnlockModal';
import { AdConsentBanner } from './components/AdConsentBanner';
import { AchievementsScreen } from './components/AchievementsScreen';
import { AuthScreen } from './components/AuthScreen';
import { BottomNav } from './components/BottomNav';
import { Confetti } from './components/Confetti';
import { HomeScreen } from './components/HomeScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { ImportScreen } from './components/ImportScreen';
import { useDeviceProfile } from './hooks/useDeviceProfile';
import { useGlobalTapSound } from './hooks/useGlobalTapSound';
import { startPresenceHeartbeat } from './lib/social/presence';
import { useStreakDayWatcher } from './hooks/useStreakDayWatcher';
import {
  appGoBack,
  markNavReplace,
  useAppNavigationHistory,
  type AppNavSnapshot,
} from './hooks/useAppNavigationHistory';
import { ExamOffConfirmModal } from './components/ExamOffConfirmModal';
import { GoldReplayConfirmModal } from './components/GoldReplayConfirmModal';
import { FriendsScreen } from './components/FriendsScreen';
import { MistakesScreen } from './components/MistakesScreen';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { MultiplayerResults } from './components/MultiplayerResults';
import { ModeSelect } from './components/ModeSelect';
import { PricingScreen } from './components/PricingScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { ScanningScreen } from './components/ScanningScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { StreakClaimFlyby } from './components/StreakClaimFlyby';
import { StreakLostModal } from './components/StreakLostModal';
import { ShopScreen } from './components/ShopScreen';
import { Toast } from './components/Toast';
import { UpgradeModal } from './components/UpgradeModal';
import { FlashcardsGame } from './components/games/FlashcardsGame';
import { MatchGame } from './components/games/MatchGame';
import { QuizGame } from './components/games/QuizGame';
import { SpeakGame } from './components/games/SpeakGame';
import { TypeGame } from './components/games/TypeGame';
import { claimDailyStreak, recordSession, getGamification, getLevel } from './lib/gamification';
import { acknowledgeStreakLoss, shouldShowStreakLostModal } from './lib/wallet';
import {
  processNewUnlocks,
  snapshotUnlockedIds,
} from './lib/achievementUnlocks';
import type { AchievementDef } from './lib/achievements';
import { recordExamPass, recordMultiScan } from './lib/achievements';
import { refreshFriendCount } from './lib/social/friendCountCache';
import { notifyAchievementUnlock, notifyGoldStep, notifyStreakMilestone } from './lib/notifications';
import { playSound, playStreakSound, stopAllMusic } from './lib/sounds';
import { hapticAchievement, hapticLevelUp } from './lib/haptics';
import { initAuth, isLoggedIn, onPasswordRecovery, consumePasswordRecoveryPending, setupSyncLifecycle, waitForAuth } from './lib/auth';
import { addHistoryEntry, canAddHistory, readDeckProgress, touchHistoryPlayed, updateHistoryDeckProgress, updateHistoryMode, updateHistorySessionStats, getHistoryEntry } from './lib/history';
import { onSyncReady, pullUserData } from './lib/sync';
import { isStripeCheckoutEnabled } from './lib/stripeCheckout';
import { addExamHistoryEntry, type ExamStepGrade } from './lib/examHistory';
import {
  canEnableExamMode,
  computeExamFinalGrade,
  isExamModeLocked,
  isExamRunComplete,
  isExamRunPassed,
} from './lib/examEligibility';
import { getExamPathBudgetSeconds } from './lib/examTimer';
import { getPathStepCount } from './lib/planLimits';
import { getLocale, setLocale, t } from './lib/i18n';
import { warmupOcr } from './lib/ocr';
import { extractPairsFromImage, isAiScanEnabled } from './lib/sheetAnalysis';
import {
  canScan,
  clampImagesForImport,
  getMaxImagesPerImport,
  getScansRemaining,
  getUpgradeReasonForScan,
  hasFeature,
  recordScan,
  truncatePairs,
} from './lib/planLimits';
import { hasMinimumForGames, parseContent } from './lib/parser';
import { getNextGameForStep, isNodeAllGold, pickPathStepGames, resolveStepMode } from './lib/pathGamePlan';
import { isOralAllowedForSheet, setPathSheetType } from './lib/pathSheetType';
import {
  canOpenGamePath,
  coercePlayablePairs,
  getPlayPairs,
  hasEnoughQuizPairsRelaxed,
} from './lib/vocabulary';
import { getXpBoostMultiplier } from './lib/wallet';
import {
  countClearedSteps,
  EXAM_PASS_PCT,
  getFirstActiveStep,
  getTierFromPct,
  getXpMultiplier,
  isPathComplete,
  isTechnicalResult,
  mergeSubGameResult,
  normalizeStepProgress,
  resolvePathStepCount,
  TECHNICAL_PCT,
} from './lib/stepProgress';
import { isSpeechRecognitionSupported } from './lib/speechRecognition';
import { resetTrainingFocus, setTrainingFocus } from './lib/trainingFocus';
import { canReplayHistoryEntry } from './lib/historyReplay';
import { mergeWithDifficult } from './lib/spacedRepetition';
import { SAMPLE_PAIRS } from './lib/sample';
import { createRoom, joinRoomByCode, submitRoomScore, fetchRoomState } from './lib/social/rooms';
import { isSocialAvailable } from './lib/social/publicProfile';
import type { MultiplayerRoom, RoomPlayer } from './lib/social/types';
import { createThumbnail } from './lib/thumbnail';
import type {
  FlowScreen,
  GameMode,
  HistoryEntry,
  Locale,
  PairDirection,
  SheetType,
  SessionResult,
  GameCompleteMeta,
  TabId,
  StepProgressMap,
  TrainingFocus,
  UpgradeReason,
  WordPair,
} from './types';

const BEST_KEY = 'scanplay-best';

function loadBest(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveBest(mode: GameMode, score: number) {
  const all = loadBest();
  if ((all[mode] ?? 0) < score) {
    all[mode] = score;
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
    void import('./lib/sync').then((m) => m.scheduleSync());
  }
}

export default function App() {
  const [tab, setTab] = useState<TabId>('home');
  const [flow, setFlow] = useState<FlowScreen | null>(null);
  const [locale, setLocaleState] = useState<Locale>(getLocale);
  const [pairs, setPairs] = useState<WordPair[]>([]);
  const [mode, setMode] = useState<GameMode | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [result, setResult] = useState<SessionResult | null>(null);
  const [previousBest, setPreviousBest] = useState(0);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [passwordRecoveryHighlight, setPasswordRecoveryHighlight] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [historyReplayMode, setHistoryReplayMode] = useState(false);
  const [examMode, setExamMode] = useState(false);
  const [examRunStart, setExamRunStart] = useState<number | null>(null);
  const [examStepGrades, setExamStepGrades] = useState<ExamStepGrade[]>([]);
  const [examElapsed, setExamElapsed] = useState(0);
  const [rawPairCount, setRawPairCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [showStreakLost, setShowStreakLost] = useState(false);
  const [showExamOffConfirm, setShowExamOffConfirm] = useState(false);
  const [goldReplayPending, setGoldReplayPending] = useState<{
    stepIndex: number;
    mode: GameMode;
  } | null>(null);
  const [streakClaimPulse, setStreakClaimPulse] = useState(0);
  const [streakClaimCount, setStreakClaimCount] = useState(0);
  const [currentUnlock, setCurrentUnlock] = useState<AchievementDef | null>(null);
  const [resultNewUnlocks, setResultNewUnlocks] = useState<AchievementDef[]>([]);
  const [resultXpBefore, setResultXpBefore] = useState(0);
  const [stepProgress, setStepProgress] = useState<StepProgressMap>({});
  const [examStepProgress, setExamStepProgress] = useState<StepProgressMap>({});
  const [examModeLocked, setExamModeLocked] = useState(false);
  const [pathStepCount, setPathStepCount] = useState(() => getPathStepCount());
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [resultStepCount, setResultStepCount] = useState(0);
  const [sheetType, setSheetType] = useState<SheetType>('vocab');
  const [pairDirection, setPairDirection] = useState<PairDirection>('auto');
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImportFiles, setPendingImportFiles] = useState<File[] | null>(null);
  const [deckThumbnail, setDeckThumbnail] = useState<string | undefined>();
  const [multiplayerRoomId, setMultiplayerRoomId] = useState<string | null>(null);
  const [multiplayerSession, setMultiplayerSession] = useState<{
    room: MultiplayerRoom;
    pairs: WordPair[];
  } | null>(null);
  const [multiplayerPlayers, setMultiplayerPlayers] = useState<RoomPlayer[]>([]);
  const [sharedPathRoom, setSharedPathRoom] = useState<MultiplayerRoom | null>(null);
  const [mpScore, setMpScore] = useState({ score: 0, total: 0 });
  const pendingMultiplayerScanRef = useRef(false);
  const unlockQueueRef = useRef<AchievementDef[]>([]);
  const sessionStart = useRef(0);
  const importErrorTimer = useRef<number | null>(null);
  const device = useDeviceProfile();

  useGlobalTapSound();

  useEffect(() => {
    stopAllMusic();
  }, []);

  useEffect(() => {
    if (!isLoggedIn() || !isSocialAvailable()) return;
    return startPresenceHeartbeat();
  }, [refreshKey]);

  useEffect(() => {
    if (!examMode || !examRunStart) {
      setExamElapsed(0);
      return;
    }
    const tick = () => setExamElapsed(Math.floor((Date.now() - examRunStart) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [examMode, examRunStart]);

  const playPairs = useMemo(
    () => getPlayPairs(pairs, activeStepIndex, pairDirection),
    [pairs, activeStepIndex, pairDirection],
  );

  const pathProgress = useMemo(
    () => (examMode ? examStepProgress : stepProgress),
    [examMode, examStepProgress, stepProgress],
  );

  const refresh = () => setRefreshKey((k) => k + 1);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const goToPasswordSettings = useCallback(() => {
    setFlow(null);
    setTab('settings');
    setPasswordRecoveryHighlight(true);
    showToast(t('authRecoveryGoSettings', locale));
    refresh();
  }, [locale, showToast]);

  const celebrateAchievements = useCallback((newUnlocks: AchievementDef[]) => {
    if (newUnlocks.length === 0) return;
    for (const u of newUnlocks) {
      notifyAchievementUnlock(u.id, u.icon);
    }
    playSound('achievementUnlock');
    hapticAchievement();
    setResultNewUnlocks(newUnlocks);
    unlockQueueRef.current = newUnlocks;
    setCurrentUnlock(newUnlocks[0]);
  }, []);

  const handleSocialChange = useCallback(() => {
    refresh();
    const before = snapshotUnlockedIds();
    void refreshFriendCount().then(() => {
      celebrateAchievements(processNewUnlocks(before));
    });
  }, [celebrateAchievements]);

  const handleStreakDayChange = useCallback((justLost: boolean) => {
    refresh();
    if (justLost && shouldShowStreakLostModal()) setShowStreakLost(true);
  }, []);

  useStreakDayWatcher(handleStreakDayChange);

  useEffect(() => {
    warmupOcr();
    if (!sessionStorage.getItem('sp-audio-launched')) {
      sessionStorage.setItem('sp-audio-launched', '1');
      playSound('appLaunch');
    }
    void initAuth(refresh);
    const unsubRecovery = onPasswordRecovery(() => {
      goToPasswordSettings();
    });
    const unsubSync = onSyncReady(() => {
      if (!isLoggedIn()) return;
      if (shouldShowStreakLostModal()) setShowStreakLost(true);
      setRefreshKey((k) => k + 1);
    });
    const unsubLifecycle = setupSyncLifecycle();
    void (async () => {
      await waitForAuth();
      if (consumePasswordRecoveryPending()) {
        goToPasswordSettings();
      }
      if (!isLoggedIn() || !isStripeCheckoutEnabled()) return;
      try {
        const { refreshPlanFromStripe } = await import('./lib/stripeCheckout');
        await refreshPlanFromStripe();
        setRefreshKey((k) => k + 1);
      } catch {
        /* pullUserData / onSyncReady will retry */
      }
    })();
    return () => {
      unsubRecovery();
      unsubSync();
      unsubLifecycle();
    };
  }, [goToPasswordSettings]);

  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || !isLoggedIn()) return;
      const { hasPendingCheckout, refreshPlanFromStripe, clearPendingCheckout } =
        await import('./lib/stripeCheckout');
      const { getPlan } = await import('./lib/planLimits');

      if (hasPendingCheckout()) {
        const sub = await refreshPlanFromStripe();
        if (sub?.plan === 'plus' || sub?.plan === 'pro') {
          clearPendingCheckout();
          setRefreshKey((k) => k + 1);
          showToast(t('stripeSuccess', getLocale()));
          playSound('premiumUnlock');
          return;
        }
        await pullUserData({ skipStripeSync: true });
        if (getPlan() === 'plus' || getPlan() === 'pro') {
          clearPendingCheckout();
          setRefreshKey((k) => k + 1);
          showToast(t('stripeSuccess', getLocale()));
          playSound('premiumUnlock');
        }
        return;
      }

      if (!isStripeCheckoutEnabled()) return;
      void import('./lib/stripeCheckout').then((m) =>
        m.refreshPlanFromStripe().then(() => setRefreshKey((k) => k + 1)),
      );
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [showToast]);

  const closeFlow = () => {
    setFlow(null);
    setExamMode(false);
    setHistoryReplayMode(false);
    setDeckThumbnail(undefined);
    setExamRunStart(null);
    setExamStepGrades([]);
    setExamStepProgress({});
    setExamModeLocked(false);
    setMultiplayerRoomId(null);
    setMultiplayerSession(null);
    setMultiplayerPlayers([]);
    setPendingImportFiles(null);
    resetTrainingFocus();
  };

  const handleExamToggle = () => {
    setExamMode((prev) => {
      const next = !prev;
      if (next) {
        setExamRunStart(Date.now());
        setExamStepGrades([]);
      } else {
        setExamRunStart(null);
        setExamStepGrades([]);
      }
      return next;
    });
  };

  const handleExamToggleRequest = () => {
    if (!examMode) {
      if (!canEnableExamMode(examModeLocked, stepProgress, pathStepCount, pairs)) {
        showToast(t('examLockedNormalProgress', locale));
        return;
      }
      handleExamToggle();
      return;
    }
    setShowExamOffConfirm(true);
  };

  const confirmExamOff = () => {
    setShowExamOffConfirm(false);
    setExamMode(false);
    setExamRunStart(null);
    setExamStepGrades([]);
    setExamModeLocked(true);
    if (historyId) {
      updateHistoryDeckProgress(historyId, { examModeLocked: true });
    }
  };

  const finalizeExamRun = useCallback(
    (grades: ExamStepGrade[], examProgress: StepProgressMap) => {
      if (!historyId || grades.length === 0) return;
      const entry = getHistoryEntry(historyId);
      const finalGrade = computeExamFinalGrade(grades);
      const passed = isExamRunPassed(examProgress, grades, pathStepCount, pairs);
      const totalTimeSeconds = examRunStart
        ? Math.max(1, Math.round((Date.now() - examRunStart) / 1000))
        : 0;
      addExamHistoryEntry({
        deckId: historyId,
        deckTitle: entry?.title ?? 'Deck',
        thumbnail: entry?.thumbnail ?? deckThumbnail,
        finalGrade,
        passed,
        stepGrades: grades,
        pathStepCount,
        totalTimeSeconds,
      });
      updateHistoryDeckProgress(historyId, {
        stepProgress,
        examStepProgress: examProgress,
        examModeLocked: true,
      });
      setExamModeLocked(true);
      showToast(
        passed
          ? t('examFinalPass', locale).replace('{grade}', String(finalGrade))
          : t('examFinalFail', locale).replace('{grade}', String(finalGrade)),
      );
      setExamRunStart(null);
      setExamStepGrades([]);
      refresh();
    },
    [historyId, deckThumbnail, examRunStart, locale, showToast, refresh, pathStepCount, pairs, stepProgress],
  );

  const requireAuth = useCallback((): boolean => {
    if (isLoggedIn()) return true;
    setFlow('auth');
    return false;
  }, []);

  useEffect(() => {
    return () => {
      if (importErrorTimer.current) clearTimeout(importErrorTimer.current);
    };
  }, []);

  const clearImportErrorSoon = useCallback(() => {
    if (importErrorTimer.current) clearTimeout(importErrorTimer.current);
    importErrorTimer.current = window.setTimeout(() => {
      setImportError(null);
      importErrorTimer.current = null;
    }, 5000);
  }, []);

  const dismissImportError = useCallback(() => {
    if (importErrorTimer.current) {
      clearTimeout(importErrorTimer.current);
      importErrorTimer.current = null;
    }
    setImportError(null);
  }, []);

  const failImport = useCallback(
    (message: string) => {
      markNavReplace();
      setScanProgress(0);
      setScanStatus('');
      setImportError(message);
      setFlow('import');
      clearImportErrorSoon();
    },
    [clearImportErrorSoon],
  );

  const ensurePathRoomForDeck = useCallback(
    async (deckPairs: WordPair[], steps: number) => {
      if (!isLoggedIn() || !hasFeature('multiplayer') || !isSocialAvailable()) return;
      const title = deckPairs[0]?.term?.slice(0, 50) ?? 'ScanPlay';
      const room = await createRoom(title, deckPairs, { pathStepCount: steps });
      if (room) {
        setSharedPathRoom(room);
        setMultiplayerRoomId(room.id);
      } else {
        showToast(t('friendsRoomError', locale));
      }
    },
    [locale, showToast],
  );

  const goModes = useCallback(
    (content: WordPair[], thumbnail?: string, fromHistory = false, isDemo = false) => {
      try {
        setRawPairCount(content.length);
        let parsed = truncatePairs(content);
        parsed = mergeWithDifficult(parsed);
        if (parsed.length === 0) {
          if (isDemo) parsed = SAMPLE_PAIRS;
          else {
            failImport(t('ocrEmpty', locale));
            return;
          }
        }
        if (!isDemo && !canOpenGamePath(parsed)) {
          failImport(t('sheetUnreadable', locale));
          return;
        }
        setPairs(parsed);
        setDeckThumbnail(thumbnail);
        if (!fromHistory) {
          setHistoryReplayMode(false);
        }
        if (!fromHistory && canAddHistory()) {
          try {
            const entry = addHistoryEntry(parsed, thumbnail, undefined, sheetType);
            setHistoryId(entry.id);
          } catch {
            /* storage unavailable */
          }
        }
        setStepProgress({});
        setExamStepProgress({});
        setExamModeLocked(false);
        setPathStepCount(getPathStepCount());
        setActiveStepIndex(null);
        setScanProgress(100);
        setScanStatus('');
        markNavReplace();
        setFlow('modes');
        void ensurePathRoomForDeck(parsed, getPathStepCount());
      } catch {
        failImport(t('ocrEmpty', locale));
      }
    },
    [locale, failImport, ensurePathRoomForDeck, sheetType],
  );

  const finishExtracted = useCallback(
    (parsed: WordPair[], thumbnail?: string, usedSample = false) => {
      if (parsed.length === 0) {
        if (usedSample) {
          goModes(SAMPLE_PAIRS, thumbnail, false, true);
        } else {
          failImport(t('ocrEmpty', locale));
        }
        return;
      }

      if (!usedSample && !canOpenGamePath(parsed)) {
        failImport(t('sheetUnreadable', locale));
        return;
      }

      if (!hasMinimumForGames(parsed) && !usedSample) {
        setImportError(t('ocrFewWords', locale));
      } else {
        setImportError(null);
      }

      setScanProgress(100);
      setScanStatus('');
      goModes(parsed, thumbnail, false, usedSample);
      playSound('scanComplete');
      playSound('ocrComplete');
    },
    [goModes, locale, failImport],
  );

  const processText = useCallback(
    (text: string, thumbnail?: string, usedSample = false) => {
      const raw = parseContent(text, sheetType);
      finishExtracted(coercePlayablePairs(raw), thumbnail, usedSample);
    },
    [finishExtracted, sheetType],
  );

  const startScanFlow = (files?: File[]) => {
    if (!requireAuth()) return;
    const reason = getUpgradeReasonForScan();
    if (reason) {
      setUpgradeReason(reason);
      return;
    }
    dismissImportError();
    if (files?.length) {
      const { files: clamped, dropped } = clampImagesForImport(files);
      if (clamped.length === 0) {
        setUpgradeReason('scans');
        return;
      }
      if (dropped > 0) {
        showToast(
          t('scanPhotosLimited', locale)
            .replace('{max}', String(getMaxImagesPerImport()))
            .replace('{dropped}', String(dropped)),
        );
      }
      setPendingImportFiles(clamped);
    } else {
      setPendingImportFiles(null);
    }
    playSound('cameraOpen');
    setFlow('import');
  };

  const processImage = useCallback(
    async (file: File | File[], focus: TrainingFocus[] = ['written', 'oral']) => {
      if (!requireAuth()) return;
      const rawFiles = Array.isArray(file) ? file : [file];
      const { files, dropped } = clampImagesForImport(rawFiles);
      if (files.length === 0) return;

      setTrainingFocus(focus);

      const remaining = getScansRemaining();
      if (remaining !== Infinity && files.length > remaining) {
        setUpgradeReason('scans');
        return;
      }
      if (!canScan()) {
        setUpgradeReason('scans');
        return;
      }
      if (dropped > 0) {
        showToast(
          t('scanPhotosLimited', locale)
            .replace('{max}', String(getMaxImagesPerImport()))
            .replace('{dropped}', String(dropped)),
        );
      }
      if (remaining !== Infinity && files.length >= remaining) {
        showToast(t('scanLastWarning', locale));
      }
      if (files.length > 1) recordMultiScan();
      const batchSize = files.length;
      for (let s = 0; s < batchSize; s += 1) {
        if (!canScan()) {
          setUpgradeReason('scans');
          return;
        }
        recordScan();
      }
      setFlow('scanning');
      playSound('scanStart');
      setScanProgress(10);
      setScanStatus(
        files.length > 1
          ? t('readingMulti', locale).replace('{count}', String(files.length))
          : t('reading', locale),
      );

      let thumbnail: string | undefined;
      try {
        thumbnail = await createThumbnail(files[0]);
      } catch {
        /* optional */
      }

      let finished = false;
      const tick = window.setInterval(() => {
        setScanProgress((p) => Math.min(p + 6, 88));
      }, 250);

      const finishWithFallback = () => {
        if (finished) return;
        finished = true;
        clearInterval(tick);
        clearTimeout(safetyTimer);
        failImport(t('ocrEmpty', locale));
      };

      const safetyTimer = window.setTimeout(finishWithFallback, 55_000 + files.length * 12_000);

      try {
        const allPairs: WordPair[] = [];
        for (let i = 0; i < files.length; i += 1) {
          setScanStatus(
            files.length > 1
              ? t('readingMultiProgress', locale)
                  .replace('{current}', String(i + 1))
                  .replace('{total}', String(files.length))
              : isAiScanEnabled()
                ? t('scanningAi', locale)
                : t('reading', locale),
          );
          const { pairs, source } = await extractPairsFromImage(files[i], sheetType);
          if (source === 'ocr' && isAiScanEnabled() && i === 0) {
            setScanStatus(t('reading', locale));
          }
          allPairs.push(...pairs);
        }
        if (finished) return;
        finished = true;
        clearInterval(tick);
        clearTimeout(safetyTimer);
        setScanProgress(95);
        setScanStatus(t('building', locale));
        finishExtracted(coercePlayablePairs(allPairs), thumbnail);
      } catch {
        finishWithFallback();
      }
    },
    [locale, finishExtracted, showToast, requireAuth, sheetType, failImport],
  );

  const trySample = useCallback(() => {
    if (!requireAuth()) return;
    if (!canScan()) {
      setUpgradeReason('scans');
      return;
    }
    recordScan();
    const remaining = getScansRemaining();
    if (remaining === 1) {
      showToast(t('scanLastWarning', locale));
    }
    setFlow('scanning');
    setScanProgress(20);
    setScanStatus(t('demoLoading', locale));
    const lines = SAMPLE_PAIRS.map((p) => `${p.term} - ${p.definition}`).join('\n');
    let p = 20;
    let finished = false;
    const tick = window.setInterval(() => {
      if (finished) return;
      p += 25;
      setScanProgress(Math.min(p, 95));
      if (p >= 95) {
        finished = true;
        clearInterval(tick);
        processText(lines, undefined, true);
      }
    }, 120);
    window.setTimeout(() => {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      processText(lines, undefined, true);
    }, 4000);
  }, [locale, processText, showToast, requireAuth]);

  const openHistoryDeck = (entry: HistoryEntry) => {
    if (!requireAuth()) return;
    if (!canReplayHistoryEntry(entry.id)) {
      setUpgradeReason('historyReplay');
      return;
    }
    const playable = coercePlayablePairs(entry.pairs);
    const merged = truncatePairs(mergeWithDifficult(playable));
    if (!canOpenGamePath(merged)) {
      showToast(t('sheetUnreadable', locale));
      return;
    }
    setHistoryReplayMode(true);
    setHistoryId(entry.id);
    setRawPairCount(playable.length);
    setPairs(merged);
    setDeckThumbnail(entry.thumbnail);
    if (entry.sheetType) setSheetType(entry.sheetType);
    const bundle = readDeckProgress(entry);
    const progress = normalizeStepProgress(bundle.stepProgress, entry.completedSteps);
    const steps = resolvePathStepCount(entry.pathStepCount);
    setPathStepCount(steps);
    setStepProgress(progress);
    setExamStepProgress(bundle.examStepProgress);
    setExamModeLocked(isExamModeLocked(bundle.examModeLocked, progress, steps, merged));
    setActiveStepIndex(null);
    setTab('home');
    setFlow('modes');
    void ensurePathRoomForDeck(merged, resolvePathStepCount(entry.pathStepCount));
  };

  const startGame = (m: GameMode, stepIndex?: number, deckPairs?: WordPair[], skipGoldConfirm = false) => {
    if (!requireAuth()) return;
    const base = deckPairs ?? pairs;
    if (
      !skipGoldConfirm &&
      stepIndex !== undefined &&
      !examMode &&
      isNodeAllGold(stepIndex, stepProgress, getPlayPairs(base, stepIndex, pairDirection))
    ) {
      setGoldReplayPending({ stepIndex, mode: m });
      return;
    }

    const play = getPlayPairs(base, stepIndex ?? null, pairDirection);
    let resolved = resolveStepMode(m, play);
    if (resolved === 'speak' && !isOralAllowedForSheet(sheetType)) {
      resolved = resolveStepMode('type', play);
    }
    if (resolved === 'speak' && !isSpeechRecognitionSupported()) {
      showToast(t('speakUnsupported', locale));
      return;
    }
    if (resolved === 'quiz' && !hasEnoughQuizPairsRelaxed(play)) {
      showToast(t('stepNeedMoreWords', locale));
      return;
    }
    if (play.length < 1) {
      showToast(t('sheetUnreadable', locale));
      return;
    }

    const { claimed, newStreak } = claimDailyStreak();
    if (claimed) {
      setStreakClaimCount(newStreak);
      setStreakClaimPulse((k) => k + 1);
      refresh();
      playSound('streakDaily');
      playStreakSound(newStreak);
      if ([3, 7, 30].includes(newStreak)) {
        notifyStreakMilestone(newStreak);
      }
    }

    if (deckPairs) setPairs(deckPairs);
    setMode(resolved);
    if (stepIndex !== undefined) setActiveStepIndex(stepIndex);
    if (historyId) updateHistoryMode(historyId, m);
    sessionStart.current = Date.now();
    playSound('quizStart');
    setFlow('playing');
  };

  const dismissUnlock = useCallback(() => {
    const rest = unlockQueueRef.current.slice(1);
    unlockQueueRef.current = rest;
    setCurrentUnlock(rest[0] ?? null);
  }, []);

  const endGame = (score: number, total: number, meta?: GameCompleteMeta) => {
    if (!mode) return;

    if (multiplayerSession) {
      void (async () => {
        await submitRoomScore(multiplayerSession.room.id, score, total);
        setMpScore({ score, total });
        const { players } = await fetchRoomState(multiplayerSession.room.id);
        setMultiplayerPlayers(players);
        playSound(score === total ? 'perfect' : 'correct');
        setFlow('multiplayerResults');
      })();
      return;
    }

    const technical = meta?.technical === true;
    const pct = technical
      ? TECHNICAL_PCT
      : total > 0
        ? Math.round((score / total) * 100)
        : 0;
    const examPassed = !examMode || pct >= EXAM_PASS_PCT || isTechnicalResult(pct);
    if (examMode && examPassed) recordExamPass();

    const playPairsForStep =
      activeStepIndex !== null ? getPlayPairs(pairs, activeStepIndex, pairDirection) : pairs;
    const goldReplay =
      !technical &&
      activeStepIndex !== null &&
      !examMode &&
      isNodeAllGold(activeStepIndex, stepProgress, playPairsForStep);

    const xpBefore = getGamification().xp;
    const levelBefore = getLevel(xpBefore);
    const unlockSnapshot = snapshotUnlockedIds();

    const stepTier = technical ? undefined : getTierFromPct(pct) ?? undefined;
    let xpEarned = 0;
    let streakUpdated = false;
    let newStreak = getGamification().streak;

    if (!goldReplay && !technical) {
      const xpMultiplier = getXpMultiplier(stepTier ?? 'bronze') * getXpBoostMultiplier();
      const sessionResult = recordSession(score, xpMultiplier);
      xpEarned = sessionResult.xpEarned;
      streakUpdated = sessionResult.streakUpdated;
      newStreak = sessionResult.newStreak;
    }

    const levelAfter = getLevel(getGamification().xp);

    const newUnlocks = goldReplay || technical ? [] : processNewUnlocks(unlockSnapshot);
    if (newUnlocks.length > 0) {
      celebrateAchievements(newUnlocks);
    } else {
      setResultNewUnlocks([]);
    }

    if (!goldReplay && !technical && levelAfter > levelBefore) {
      playSound('levelUp');
      hapticLevelUp();
    } else if (!goldReplay && !technical && xpEarned > 0) playSound('xpGain');
    if (!goldReplay && !technical && streakUpdated && [3, 7, 30].includes(newStreak)) {
      playStreakSound(newStreak);
      notifyStreakMilestone(newStreak);
    }
    if (!goldReplay && !technical && stepTier === 'gold') {
      notifyGoldStep();
      playSound('goalComplete');
    }

    setResultXpBefore(xpBefore);

    const session: SessionResult = {
      mode,
      score,
      total,
      timeSeconds: Math.max(1, Math.round((Date.now() - sessionStart.current) / 1000)),
      xpEarned,
      examMode,
      examPassed,
      stepTier,
      stepPct: pct,
      goldReplay,
      technical,
    };
    const prev = loadBest()[mode] ?? 0;
    setPreviousBest(prev);
    const isNewBest = !technical && score > prev;
    if (!technical) saveBest(mode, score);

    let updatedProgress = stepProgress;
    let updatedExamProgress = examStepProgress;
    if (activeStepIndex !== null && (!examMode || pct >= EXAM_PASS_PCT || isTechnicalResult(pct))) {
      const play = getPlayPairs(pairs, activeStepIndex, pairDirection);
      if (examMode) {
        updatedExamProgress = mergeSubGameResult(examStepProgress, activeStepIndex, mode, pct, play);
        setExamStepProgress(updatedExamProgress);
        if (historyId) {
          updateHistoryDeckProgress(historyId, { examStepProgress: updatedExamProgress });
        }
      } else {
        updatedProgress = mergeSubGameResult(stepProgress, activeStepIndex, mode, pct, play);
        setStepProgress(updatedProgress);
        const locked = isExamModeLocked(examModeLocked, updatedProgress, pathStepCount, pairs);
        if (locked && !examModeLocked) {
          setExamModeLocked(true);
        }
        if (historyId) {
          updateHistoryDeckProgress(historyId, {
            stepProgress: updatedProgress,
            examModeLocked: locked || examModeLocked,
          });
        }
      }
      if (!examMode) playSound('nodeStep');
    }
    if (!technical && score === total && total > 0) playSound('perfect');
    playSound('sessionFinish');
    let newExamGrades = examStepGrades;
    if (examMode && activeStepIndex !== null && mode) {
      const stepGrade: ExamStepGrade = {
        stepIndex: activeStepIndex,
        mode,
        pct,
        passed: examPassed,
      };
      newExamGrades = [
        ...examStepGrades.filter((g) => g.stepIndex !== activeStepIndex),
        stepGrade,
      ];
      setExamStepGrades(newExamGrades);
    }
    const progressForCount = examMode ? updatedExamProgress : updatedProgress;
    setResultStepCount(countClearedSteps(progressForCount, examMode, pathStepCount, pairs));
    if (historyId && !examMode && !technical) {
      if (goldReplay) touchHistoryPlayed(historyId);
      else updateHistorySessionStats(historyId, pct, xpEarned);
    }
    if (
      examMode &&
      historyId &&
      isExamRunComplete(updatedExamProgress, newExamGrades, pathStepCount, pairs)
    ) {
      finalizeExamRun(newExamGrades, updatedExamProgress);
    }
    const shouldConfetti = !goldReplay && !technical && (isNewBest || pct >= 90 || stepTier === 'gold');
    if (shouldConfetti) setShowConfetti(true);
    setResult(session);
    setFlow('results');
    refresh();
  };

  const handleLocaleChange = (loc: Locale) => {
    setLocale(loc);
    setLocaleState(loc);
    document.documentElement.lang = loc;
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    setPathSheetType(sheetType);
  }, [sheetType]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripe = params.get('stripe');
    if (!stripe) return;

    const loc = getLocale();
    const sessionId = params.get('session_id');
    if (stripe === 'success' || stripe === 'portal') {
      const runSync = async () => {
        const { activatePlanAfterCheckout, clearPendingCheckout, refreshPlanFromStripe } =
          await import('./lib/stripeCheckout');
        const { waitForAuth } = await import('./lib/auth');
        const { getPlan } = await import('./lib/planLimits');

        await waitForAuth();

        let activated = false;
        try {
          if (stripe === 'success' && sessionId) {
            const sub = await activatePlanAfterCheckout(sessionId);
            activated = sub?.plan === 'plus' || sub?.plan === 'pro';
          } else {
            const sub = await refreshPlanFromStripe();
            activated = sub?.plan === 'plus' || sub?.plan === 'pro';
          }

          if (!activated) {
            await pullUserData({ skipStripeSync: true });
            activated = getPlan() === 'plus' || getPlan() === 'pro';
          } else {
            await pullUserData({ skipStripeSync: true });
          }
        } catch {
          await pullUserData({ checkoutSessionId: sessionId, skipStripeSync: !sessionId });
          activated = getPlan() === 'plus' || getPlan() === 'pro';
        }

        clearPendingCheckout();
        setRefreshKey((k) => k + 1);

        if (activated) {
          showToast(t('stripeSuccess', loc));
          playSound('premiumUnlock');
        } else {
          showToast(t('stripeSyncPending', loc));
        }
      };
      void runSync();
    } else if (stripe === 'cancel') {
      void import('./lib/stripeCheckout').then((m) => m.clearPendingCheckout());
      showToast(t('stripeCancel', loc));
    }

    params.delete('stripe');
    params.delete('session_id');
    const next = params.toString();
    const url = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', url);
  }, [showToast]);

  const prevHomeRef = useRef(false);
  const homeInitRef = useRef(false);
  useEffect(() => {
    const onHome = tab === 'home' && flow === null;
    if (!homeInitRef.current) {
      homeInitRef.current = true;
      prevHomeRef.current = onHome;
      return;
    }
    if (onHome && !prevHomeRef.current) playSound('homeOpen');
    prevHomeRef.current = onHome;
  }, [tab, flow]);

  const showBottomNav = device.kind === 'desktop' || flow === null;

  const handleAuthSuccess = () => {
    closeFlow();
    refresh();
  };

  const openSharedPathFromRoom = useCallback(
    (room: MultiplayerRoom) => {
      let playable = coercePlayablePairs(room.pairs);
      playable = truncatePairs(mergeWithDifficult(playable));
      if (!canOpenGamePath(playable)) {
        showToast(t('sheetUnreadable', locale));
        return;
      }
      setSharedPathRoom(room);
      setMultiplayerRoomId(room.id);
      setHistoryId(null);
      setHistoryReplayMode(true);
      setPathStepCount(room.pathStepCount);
      setPairs(playable);
      setRawPairCount(playable.length);
      setStepProgress({});
      setActiveStepIndex(null);
      setExamMode(false);
      setMultiplayerSession(null);
      markNavReplace();
      setTab('home');
      setFlow('modes');
    },
    [locale, showToast],
  );

  const handleStartMultiplayerScan = useCallback(() => {
    if (!requireAuth()) return;
    if (!hasFeature('multiplayer')) {
      setUpgradeReason('multiplayer');
      return;
    }
    pendingMultiplayerScanRef.current = true;
    startScanFlow();
  }, [requireAuth]);

  const handleJoinPathByCode = useCallback(
    async (code: string) => {
      if (!requireAuth()) return;
      if (!hasFeature('multiplayer')) {
        setUpgradeReason('multiplayer');
        return;
      }
      const room = await joinRoomByCode(code.trim().toUpperCase());
      if (!room) {
        showToast(t('friendsJoinError', locale));
        return;
      }
      openSharedPathFromRoom(room);
    },
    [locale, openSharedPathFromRoom, requireAuth, showToast],
  );

  const handleOpenMultiplayerLobby = useCallback(() => {
    if (!sharedPathRoom) return;
    setMultiplayerRoomId(sharedPathRoom.id);
    markNavReplace();
    setFlow('multiplayerLobby');
  }, [sharedPathRoom]);

  const startMultiplayerQuiz = useCallback((room: MultiplayerRoom) => {
    const playable = coercePlayablePairs(room.pairs);
    setMultiplayerSession({ room, pairs: playable });
    setPairs(playable);
    setMode('quiz');
    setExamMode(false);
    setActiveStepIndex(null);
    sessionStart.current = Date.now();
    playSound('quizStart');
    setFlow('playing');
  }, []);

  const handleTabChange = (next: TabId) => {
    if (flow !== null) {
      closeFlow();
      setMode(null);
      setResult(null);
      setShowConfetti(false);
    }
    if ((next === 'history' || next === 'friends' || next === 'mistakes' || next === 'achievements') && !isLoggedIn()) {
      setTab(next);
      setFlow('auth');
      return;
    }
    setTab(next);
  };

  const navSnapshot = useMemo<AppNavSnapshot>(
    () => ({ tab, flow, mode }),
    [tab, flow, mode],
  );

  const applyNavSnapshot = useCallback((s: AppNavSnapshot) => {
    setTab(s.tab);
    setFlow(s.flow);
    setMode(s.mode);
    if (s.flow !== 'results') {
      setResult(null);
      setShowConfetti(false);
    }
    if (s.flow === null) {
      setActiveStepIndex(null);
      setExamMode(false);
      setExamRunStart(null);
      setExamStepGrades([]);
    }
  }, []);

  useAppNavigationHistory(navSnapshot, applyNavSnapshot, {
    onModalBack: () => {
      if (upgradeReason) {
        setUpgradeReason(null);
        return true;
      }
      if (showStreakLost) {
        acknowledgeStreakLoss();
        setShowStreakLost(false);
        return true;
      }
      if (showExamOffConfirm) {
        setShowExamOffConfirm(false);
        return true;
      }
      if (goldReplayPending) {
        setGoldReplayPending(null);
        return true;
      }
      return false;
    },
  });

  return (
    <div className="app-shell" data-device={device.kind}>
      <Confetti active={showConfetti} />
      <StreakClaimFlyby locale={locale} streak={streakClaimCount} pulseKey={streakClaimPulse} />
      <AchievementUnlockModal
        achievement={currentUnlock}
        locale={locale}
        onDismiss={dismissUnlock}
      />
      <Toast message={toast} />
      <AdConsentBanner locale={locale} />

      {showBottomNav && (
        <BottomNav active={tab} onChange={handleTabChange} locale={locale} device={device.kind} />
      )}

      <div className="app-main">

      {showStreakLost && (
        <StreakLostModal
          locale={locale}
          onClose={() => {
            acknowledgeStreakLoss();
            setShowStreakLost(false);
          }}
          onOpenShop={() => {
            acknowledgeStreakLoss();
            setShowStreakLost(false);
            setTab('shop');
          }}
        />
      )}

      {showExamOffConfirm && (
        <ExamOffConfirmModal
          locale={locale}
          onConfirm={confirmExamOff}
          onCancel={() => setShowExamOffConfirm(false)}
        />
      )}

      {goldReplayPending && (
        <GoldReplayConfirmModal
          locale={locale}
          onConfirm={() => {
            const pending = goldReplayPending;
            setGoldReplayPending(null);
            startGame(pending.mode, pending.stepIndex, undefined, true);
          }}
          onCancel={() => setGoldReplayPending(null)}
        />
      )}

      {upgradeReason && (
        <UpgradeModal
          reason={upgradeReason}
          locale={locale}
          onClose={() => setUpgradeReason(null)}
          onUpgrade={() => {
            setUpgradeReason(null);
            setFlow('pricing');
          }}
        />
      )}

      {flow === null && tab === 'home' && (
        <HomeScreen
          locale={locale}
          refreshKey={refreshKey}
          streakPulseKey={streakClaimPulse}
          device={device}
          onScanPlay={startScanFlow}
          onTrySample={trySample}
          onPricing={() => setFlow('pricing')}
          onSocialChange={handleSocialChange}
          onToast={showToast}
        />
      )}
      {flow === null && tab === 'history' && (
        <HistoryScreen
          locale={locale}
          refreshKey={refreshKey}
          onRefresh={refresh}
          onOpenDeck={openHistoryDeck}
          onUpgrade={(reason) => setUpgradeReason(reason)}
          onToast={showToast}
          onAuth={() => setFlow('auth')}
          isLoggedIn={isLoggedIn()}
        />
      )}
      {flow === null && tab === 'friends' && (
        <FriendsScreen
          locale={locale}
          refreshKey={refreshKey}
          isLoggedIn={isLoggedIn()}
          onAuth={() => setFlow('auth')}
          onUpgrade={() => setUpgradeReason('multiplayer')}
          onStartScanForGame={handleStartMultiplayerScan}
          onJoinRoom={(code) => void handleJoinPathByCode(code)}
          onSocialChange={handleSocialChange}
        />
      )}
      {flow === null && tab === 'shop' && (
        <ShopScreen locale={locale} refreshKey={refreshKey} onRefresh={refresh} />
      )}
      {flow === null && tab === 'mistakes' && (
        <MistakesScreen locale={locale} refreshKey={refreshKey} />
      )}
      {flow === null && tab === 'achievements' && (
        <AchievementsScreen locale={locale} refreshKey={refreshKey} />
      )}
      {flow === null && tab === 'settings' && (
        <SettingsScreen
          locale={locale}
          device={device}
          refreshKey={refreshKey}
          onLocaleChange={handleLocaleChange}
          onAuth={() => setFlow('auth')}
          isLoggedIn={isLoggedIn()}
          onLogout={() => {
            closeFlow();
            refresh();
          }}
          onPricing={() => setFlow('pricing')}
          onRefresh={refresh}
          onToast={showToast}
          highlightPasswordRecovery={passwordRecoveryHighlight}
          onPasswordHighlightDone={() => setPasswordRecoveryHighlight(false)}
        />
      )}

      {flow === 'import' && (
        <ImportScreen
          locale={locale}
          sheetType={sheetType}
          importError={importError}
          isDesktop={device.kind === 'desktop'}
          initialFiles={pendingImportFiles ?? undefined}
          onBack={appGoBack}
          onSheetTypeChange={setSheetType}
          onFile={processImage}
          onToast={showToast}
        />
      )}
      {flow === 'scanning' && (
        <ScanningScreen
          locale={locale}
          progress={scanProgress}
          status={scanStatus || t('scanning', locale)}
        />
      )}
      {flow === 'modes' && (
        <ModeSelect
          locale={locale}
          pairs={pairs}
          rawPairCount={rawPairCount}
          examMode={examMode}
          examModeLocked={examModeLocked}
          stepProgress={pathProgress}
          refreshKey={refreshKey}
          streakPulseKey={streakClaimPulse}
          onSocialChange={handleSocialChange}
          examElapsed={examElapsed}
          examPathBudget={getExamPathBudgetSeconds(pathStepCount)}
          pathStepCount={pathStepCount}
          sharedPathRoom={sharedPathRoom}
          onOpenMultiplayerLobby={handleOpenMultiplayerLobby}
          onExamToggle={handleExamToggleRequest}
          onUpgrade={(reason) => setUpgradeReason(reason)}
          onToast={showToast}
          onSelect={(stepIdx, m) => startGame(m, stepIdx)}
          pairDirection={pairDirection}
          onDirectionChange={setPairDirection}
          onRescan={() => {
            closeFlow();
            startScanFlow();
          }}
          onHome={() => {
            if (historyId) {
              updateHistoryDeckProgress(historyId, {
                stepProgress,
                examStepProgress,
                examModeLocked,
              });
            }
            markNavReplace();
            closeFlow();
            setTab('home');
          }}
          historyReplay={historyReplayMode}
          deckThumbnail={deckThumbnail}
          sheetType={sheetType}
          onAuth={() => setFlow('auth')}
        />
      )}
      {flow === 'playing' && mode === 'flashcards' && (
        <FlashcardsGame
          pairs={playPairs}
          locale={locale}
          examMode={examMode}
          deckId={historyId}
          stepIndex={activeStepIndex}
          onComplete={endGame}
          onExit={appGoBack}
        />
      )}
      {flow === 'multiplayerLobby' && multiplayerRoomId && (
        <MultiplayerLobby
          locale={locale}
          roomId={multiplayerRoomId}
          onBack={() => {
            closeFlow();
            setTab('friends');
          }}
          onStart={(room) => startMultiplayerQuiz(room)}
          onError={(msg) => showToast(msg)}
        />
      )}
      {flow === 'playing' && mode === 'quiz' && (
        <QuizGame
          pairs={multiplayerSession ? multiplayerSession.pairs : playPairs}
          locale={locale}
          examMode={examMode}
          deckId={historyId}
          stepIndex={activeStepIndex}
          shuffleSeed={multiplayerSession?.room.quizSeed}
          onComplete={endGame}
          onExit={appGoBack}
          onNotEnoughPairs={() => showToast(t('stepNeedMoreWords', locale))}
        />
      )}
      {flow === 'multiplayerResults' && multiplayerSession && (
        <MultiplayerResults
          locale={locale}
          deckTitle={multiplayerSession.room.deckTitle}
          players={multiplayerPlayers}
          myScore={mpScore.score}
          myTotal={mpScore.total}
          onHome={() => {
            markNavReplace();
            closeFlow();
            setTab('friends');
            setMode(null);
          }}
        />
      )}
      {flow === 'playing' && mode === 'type' && (
        <TypeGame
          pairs={playPairs}
          locale={locale}
          examMode={examMode}
          deckId={historyId}
          stepIndex={activeStepIndex}
          sheetType={sheetType}
          onComplete={endGame}
          onExit={appGoBack}
          onToast={showToast}
        />
      )}
      {flow === 'playing' && mode === 'speak' && (
        <SpeakGame
          pairs={playPairs}
          locale={locale}
          examMode={examMode}
          deckId={historyId}
          stepIndex={activeStepIndex}
          onComplete={endGame}
          onExit={appGoBack}
        />
      )}
      {flow === 'playing' && mode === 'match' && (
        <MatchGame
          pairs={playPairs}
          locale={locale}
          examMode={examMode}
          deckId={historyId}
          stepIndex={activeStepIndex}
          onComplete={endGame}
          onExit={appGoBack}
        />
      )}
      {flow === 'results' && result && (
        <ResultsScreen
          locale={locale}
          result={result}
          bestScore={previousBest}
          pathComplete={
            isPathComplete(pathProgress, examMode, pathStepCount, pairs) ||
            resultStepCount >= pathStepCount
          }
          stepsDone={resultStepCount}
          stepsTotal={pathStepCount}
          xpBefore={resultXpBefore}
          newUnlocks={resultNewUnlocks}
          refreshKey={refreshKey}
          onSocialChange={handleSocialChange}
          onContinue={() => {
            markNavReplace();
            if (activeStepIndex !== null) {
              const play = getPlayPairs(pairs, activeStepIndex, pairDirection);
              const next = getNextGameForStep(activeStepIndex, pathProgress, play);
              if (next) {
                startGame(next, activeStepIndex);
                setResult(null);
                setShowConfetti(false);
                return;
              }

              const nextStep = getFirstActiveStep(pathProgress, pathStepCount, examMode, pairs);
              if (nextStep < pathStepCount && nextStep !== activeStepIndex) {
                const playNext = getPlayPairs(pairs, nextStep, pairDirection);
                const games = pickPathStepGames(nextStep, playNext);
                const nextMode =
                  getNextGameForStep(nextStep, pathProgress, playNext) ?? games[0] ?? null;
                if (nextMode) {
                  startGame(nextMode, nextStep);
                  setResult(null);
                  setShowConfetti(false);
                  return;
                }
              }
            }
            setFlow('modes');
            setResult(null);
            setShowConfetti(false);
          }}
          onReplay={() => mode && activeStepIndex !== null && startGame(mode, activeStepIndex)}
          examFailed={result.examMode === true && result.examPassed === false}
          onHome={() => {
            if (historyId) {
              updateHistoryDeckProgress(historyId, {
                stepProgress,
                examStepProgress,
                examModeLocked,
              });
            }
            markNavReplace();
            closeFlow();
            setTab('home');
            setMode(null);
            setResult(null);
            setShowConfetti(false);
            setActiveStepIndex(null);
          }}
        />
      )}
      {flow === 'auth' && (
        <AuthScreen
          locale={locale}
          variant="action"
          onBack={appGoBack}
          onSuccess={handleAuthSuccess}
        />
      )}
      {flow === 'pricing' && (
        <PricingScreen
          locale={locale}
          refreshKey={refreshKey}
          onBack={appGoBack}
          onAuth={() => setFlow('auth')}
          onToast={showToast}
          onSelect={() => {
            playSound('premiumUnlock');
            closeFlow();
            refresh();
          }}
        />
      )}

      </div>
    </div>
  );
}
