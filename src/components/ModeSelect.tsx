import { BrandDecor } from './BrandDecor';
import { SynthesisActions } from './SynthesisActions';
import { GamePath } from './GamePath';
import { GamificationHUD } from './GamificationHUD';
import { LearningFlow } from './LearningFlow';
import { LogoWordmark } from './Logo';
import { NotificationCenter } from './NotificationCenter';
import { PlanBadge } from './PlanBadge';
import { usePlan } from '../hooks/usePlan';
import { getDueReviewCount } from '../lib/spacedRepetition';
import { hasFeature, PLAN_LIMITS } from '../lib/planLimits';
import { t } from '../lib/i18n';
import { playSound } from '../lib/sounds';
import type { MultiplayerRoom } from '../lib/social/types';
import type { GameMode, Locale, PairDirection, SheetType, StepProgressMap, UpgradeReason, WordPair } from '../types';

interface ModeSelectProps {
  locale: Locale;
  pairs: WordPair[];
  rawPairCount: number;
  examMode: boolean;
  examModeLocked?: boolean;
  stepProgress: StepProgressMap;
  refreshKey: number;
  streakPulseKey?: number;
  onSocialChange?: () => void;
  examElapsed?: number;
  examPathBudget?: number;
  pathStepCount: number;
  sharedPathRoom?: MultiplayerRoom | null;
  onOpenMultiplayerLobby?: () => void;
  pairDirection: PairDirection;
  onDirectionChange: (dir: PairDirection) => void;
  onExamToggle: () => void;
  onUpgrade: (reason: UpgradeReason) => void;
  onToast: (message: string) => void;
  onAuth?: () => void;
  sheetType?: SheetType;
  onSelect: (stepIndex: number, mode: GameMode) => void;
  onRescan: () => void;
  onHome: () => void;
  historyReplay?: boolean;
  deckThumbnail?: string;
}

export function ModeSelect({
  locale,
  pairs,
  rawPairCount,
  examMode,
  examModeLocked = false,
  stepProgress,
  refreshKey,
  streakPulseKey = 0,
  onSocialChange,
  examElapsed = 0,
  examPathBudget = 750,
  pathStepCount,
  sharedPathRoom = null,
  onOpenMultiplayerLobby,
  pairDirection,
  onDirectionChange,
  onExamToggle,
  onUpgrade,
  onToast,
  onAuth,
  sheetType = 'vocab',
  onSelect,
  onRescan,
  onHome,
  historyReplay = false,
  deckThumbnail,
}: ModeSelectProps) {
  const plan = usePlan(refreshKey);
  const examUnlocked = hasFeature('exam', plan);
  const canMulti = hasFeature('multiplayer', plan);
  const dueCount = getDueReviewCount();
  const truncated = plan === 'free' && rawPairCount > pairs.length;

  const directionLabel =
    pairDirection === 'auto'
      ? t('pairDirectionAuto', locale)
      : pairDirection === 'reverse'
        ? t('pairDirectionReverse', locale)
        : t('pairDirectionForward', locale);

  const cycleDirection = () => {
    const next: PairDirection =
      pairDirection === 'forward' ? 'reverse' : pairDirection === 'reverse' ? 'auto' : 'forward';
    onDirectionChange(next);
  };

  return (
    <div className="screen mode-screen flow-screen mode-screen-branded mode-screen-path">
      <BrandDecor />

      <header className="top-bar top-bar-raised top-bar-compact">
        <button type="button" className="icon-btn" onClick={onHome} aria-label={t('home', locale)}>
          🏠
        </button>
        <LogoWordmark />
        <div className="top-bar-actions">
          <NotificationCenter locale={locale} refreshKey={refreshKey} onSocialChange={onSocialChange} />
          <PlanBadge plan={plan} locale={locale} />
        </div>
      </header>

      <GamificationHUD locale={locale} refreshKey={refreshKey} streakPulseKey={streakPulseKey} />

      <main className="mode-main mode-main-path">
        <LearningFlow active="game" locale={locale} compact />

        <button type="button" className="pair-direction-toggle" onClick={cycleDirection}>
          🔄 {directionLabel}
        </button>

        {truncated && (
          <p className="words-truncated-hint">
            {t('wordsTruncated', locale)
              .replace('{used}', String(pairs.length))
              .replace('{max}', String(PLAN_LIMITS.free.maxWords))}
          </p>
        )}

        {hasFeature('spaced', plan) && dueCount > 0 && (
          <p className="spaced-due-hint">
            📅 {t('spacedDue', locale).replace('{count}', String(dueCount))}
          </p>
        )}

        {examMode && examUnlocked && (
          <div className="exam-path-chrono" role="timer" aria-live="polite">
            <span className="exam-path-chrono-icon" aria-hidden="true">
              ⏱️
            </span>
            <span>
              {t('examChrono', locale)
                .replace('{elapsed}', String(examElapsed))
                .replace('{budget}', String(examPathBudget))}
            </span>
          </div>
        )}

        <div
          className={`exam-mode-card ${examUnlocked && !examModeLocked ? '' : 'exam-mode-card--locked'}`}
        >
          <div className="exam-mode-card-head">
            <span className="exam-mode-card-icon" aria-hidden="true">
              {examUnlocked && !examModeLocked ? '🎓' : '🔒'}
            </span>
            <div>
              <strong>{t('examMode', locale)}</strong>
              <p className="exam-mode-card-desc">
                {!examUnlocked
                  ? t('upgradeExam', locale)
                  : examModeLocked
                    ? t('examLockedHint', locale)
                    : t('examModeHint', locale)}
              </p>
            </div>
          </div>
          {examUnlocked && !examModeLocked ? (
            <button
              type="button"
              className={`btn-secondary exam-mode-toggle ${examMode ? 'on' : ''}`}
              onClick={onExamToggle}
              aria-pressed={examMode}
            >
              {examMode ? t('examModeOn', locale) : t('examModeOff', locale)}
            </button>
          ) : examUnlocked && examModeLocked ? (
            <button type="button" className="btn-secondary" disabled aria-disabled="true">
              {t('examModeUnavailable', locale)}
            </button>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => onUpgrade('exam')}>
              {t('upgradePro', locale)}
            </button>
          )}
        </div>

        {sharedPathRoom && canMulti && (
          <section className="path-invite-card">
            <p className="path-invite-hint">{t('pathInviteHint', locale)}</p>
            <div className="friends-code-card path-invite-code">
              <span className="friends-code-label">{t('friendsInviteCode', locale)}</span>
              <span className="friends-code-value">{sharedPathRoom.inviteCode}</span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  void navigator.clipboard.writeText(sharedPathRoom.inviteCode).then(() => {
                    playSound('shareSuccess');
                    onToast(t('friendsCopyCode', locale));
                  });
                }}
              >
                {t('friendsCopyCode', locale)}
              </button>
            </div>
            {onOpenMultiplayerLobby && (
              <button type="button" className="btn-secondary path-invite-quiz-btn" onClick={onOpenMultiplayerLobby}>
                {t('friendsStartMultiQuiz', locale)}
              </button>
            )}
          </section>
        )}

        <SynthesisActions
          locale={locale}
          pairs={pairs}
          thumbnail={deckThumbnail}
          sheetType={sheetType}
          onUpgrade={onUpgrade}
          onToast={onToast}
          onAuth={onAuth}
        />

        <GamePath
          locale={locale}
          wordCount={pairs.length}
          pairs={pairs}
          pathStepCount={pathStepCount}
          onSelect={onSelect}
          stepProgress={stepProgress}
          historyReplay={historyReplay}
          examMode={examMode}
          sheetThumbnail={deckThumbnail}
        />

        <button type="button" className="btn-ghost scanplay-rescan" onClick={onRescan}>
          {t('scanAnother', locale)}
        </button>
      </main>
    </div>
  );
}
