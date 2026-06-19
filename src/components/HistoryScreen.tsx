import { useState } from 'react';
import { usePlan } from '../hooks/usePlan';
import { SynthesisActions } from './SynthesisActions';
import { getExamHistory, deleteExamHistoryEntry } from '../lib/examHistory';
import { getHistory, deleteHistoryEntry } from '../lib/history';
import { canReplayHistoryEntry } from '../lib/historyReplay';
import { resolvePathStepCount } from '../lib/stepProgress';
import { countGoldSteps, normalizeStepProgress } from '../lib/stepProgress';
import { getHistoryMax } from '../lib/planLimits';
import { getDateLocale, t, type TranslationKey } from '../lib/i18n';
import type { GameMode, HistoryEntry, Locale, UpgradeReason } from '../types';

interface HistoryScreenProps {
  locale: Locale;
  isLoggedIn: boolean;
  onOpenDeck: (entry: HistoryEntry) => void;
  refreshKey: number;
  onRefresh: () => void;
  onUpgrade: (reason: UpgradeReason) => void;
  onToast: (message: string) => void;
  onAuth: () => void;
}

type HistoryView = 'decks' | 'exams';

const MODE_LABELS: Record<GameMode, TranslationKey> = {
  flashcards: 'flashcards',
  quiz: 'quiz',
  match: 'match',
  type: 'modeType',
  speak: 'modeSpeak',
};

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(getDateLocale(locale), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryScreen({
  locale,
  isLoggedIn,
  onOpenDeck,
  refreshKey,
  onRefresh,
  onUpgrade,
  onToast,
  onAuth,
}: HistoryScreenProps) {
  const [view, setView] = useState<HistoryView>('decks');
  const entries = isLoggedIn ? getHistory() : [];
  const examEntries = isLoggedIn ? getExamHistory() : [];
  const historyMax = getHistoryMax();
  const plan = usePlan(refreshKey);

  const handleOpen = (entry: HistoryEntry) => {
    if (!canReplayHistoryEntry(entry.id, plan)) {
      onUpgrade('historyReplay');
      return;
    }
    onOpenDeck(entry);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t('deleteConfirm', locale))) {
      deleteHistoryEntry(id);
      onRefresh();
    }
  };

  const handleDeleteExam = (id: string) => {
    if (window.confirm(t('deleteConfirm', locale))) {
      deleteExamHistoryEntry(id);
      onRefresh();
    }
  };

  const countLabel =
    historyMax < 9999
      ? t('historyCount', locale)
          .replace('{count}', String(entries.length))
          .replace('{max}', String(historyMax))
      : `${entries.length}`;

  if (!isLoggedIn) {
    return (
      <div className="screen tab-screen">
        <header className="top-bar">
          <h2 className="screen-title">{t('historyTitle', locale)}</h2>
        </header>
        <main className="history-main scroll-natural">
          <div className="empty-state">
            <span className="empty-icon">🔐</span>
            <p>{t('historyLoginRequired', locale)}</p>
            <p className="empty-hint">{t('historyLoginHint', locale)}</p>
            <button type="button" className="btn-primary btn-lg" onClick={onAuth}>
              {t('connect', locale)}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="screen tab-screen">
      <header className="top-bar history-top-bar">
        <h2 className="screen-title">{t('historyTitle', locale)}</h2>
        {view === 'decks' && historyMax < 9999 && (
          <span className="history-limit-badge">{countLabel}</span>
        )}
      </header>

      <div className="history-subtabs">
        <button
          type="button"
          className={`history-subtab ${view === 'decks' ? 'active' : ''}`}
          onClick={() => setView('decks')}
        >
          📋 {t('historyTabDecks', locale)}
        </button>
        <button
          type="button"
          className={`history-subtab ${view === 'exams' ? 'active' : ''}`}
          onClick={() => setView('exams')}
        >
          🎓 {t('historyTabExams', locale)}
        </button>
      </div>

      <main className="history-main scroll-natural">
        {view === 'decks' && (
          <>
            {entries.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📋</span>
                <p>{t('historyEmpty', locale)}</p>
                <p className="empty-hint">{t('historyEmptyHint', locale)}</p>
              </div>
            ) : (
              <ul className="history-list">
                {entries.map((entry) => {
                  const progress = normalizeStepProgress(entry.stepProgress, entry.completedSteps);
                  const gold = countGoldSteps(progress);
                  const wordCount = entry.pairs.length;
                  const replayLocked = !canReplayHistoryEntry(entry.id, plan);
                  return (
                    <li
                      key={entry.id}
                      className={`history-card${replayLocked ? ' history-card--replay-locked' : ''}`}
                    >
                      <button
                        type="button"
                        className="history-card-play"
                        onClick={() => handleOpen(entry)}
                      >
                        <div className="history-thumb">
                          {entry.thumbnail ? <img src={entry.thumbnail} alt="" /> : <span>📄</span>}
                        </div>
                        <div className="history-card-body">
                          <div className="history-card-head">
                            <span className="history-title">{entry.title}</span>
                            {replayLocked ? (
                              <span className="history-play-label history-play-label--locked">
                                🔒 {t('historyReplayLocked', locale)}
                              </span>
                            ) : (
                              <span className="history-play-label">{t('historyPlay', locale)}</span>
                            )}
                          </div>
                          <div className="history-card-meta">
                            <span className="history-meta-pill">
                              {wordCount} {t('pathUnitWords', locale)}
                            </span>
                            {entry.lastMode && (
                              <span className="history-badge">
                                {t(MODE_LABELS[entry.lastMode], locale)}
                              </span>
                            )}
                            {gold > 0 && (
                              <span className="history-step-badge">
                                ★ {gold}/{resolvePathStepCount(entry.pathStepCount)}
                              </span>
                            )}
                            {entry.lastScorePct != null && (
                              <span className="history-session-stats">
                                {entry.lastScorePct}%
                                {entry.lastXpEarned != null && ` · +${entry.lastXpEarned} XP`}
                              </span>
                            )}
                          </div>
                          <span className="history-date">
                            {formatDate(entry.lastPlayedAt ?? entry.createdAt, locale)}
                          </span>
                        </div>
                      </button>
                      <div className="history-card-footer">
                        <SynthesisActions
                          locale={locale}
                          pairs={entry.pairs}
                          thumbnail={entry.thumbnail}
                          title={entry.title}
                          compact
                          onUpgrade={onUpgrade}
                          onToast={onToast}
                          onAuth={onAuth}
                        />
                        <button
                          type="button"
                          className="history-delete-btn"
                          onClick={(e) => handleDelete(entry.id, e)}
                          aria-label={t('delete', locale)}
                        >
                          {t('delete', locale)}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {view === 'exams' && (
          <>
            {examEntries.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🎓</span>
                <p>{t('examHistoryEmpty', locale)}</p>
                <p className="empty-hint">{t('examHistoryEmptyHint', locale)}</p>
              </div>
            ) : (
              <ul className="history-list exam-history-list">
                {examEntries.map((exam) => (
                  <li key={exam.id} className={`history-card exam-history-card${exam.passed ? '' : ' exam-history-card--fail'}`}>
                    <div className="history-card-play exam-history-card-inner">
                      <div className="history-thumb">
                        {exam.thumbnail ? <img src={exam.thumbnail} alt="" /> : <span>🎓</span>}
                      </div>
                      <div className="history-card-body">
                        <div className="history-card-head">
                          <span className="history-title">{exam.deckTitle}</span>
                          <span
                            className={`exam-grade-badge ${exam.passed ? 'exam-grade-badge--pass' : 'exam-grade-badge--fail'}`}
                          >
                            {exam.finalGrade}%
                          </span>
                        </div>
                        <div className="history-card-meta">
                          <span className="history-meta-pill">
                            {t('examFinalGrade', locale)}: {exam.finalGrade}%
                          </span>
                          <span className="history-meta-pill">
                            {exam.stepGrades.length}/{resolvePathStepCount(exam.pathStepCount)} {t('pathUnitSteps', locale)}
                          </span>
                          <span className="history-meta-pill">
                            {Math.round(exam.totalTimeSeconds / 60)} min
                          </span>
                        </div>
                        <span className="history-date">{formatDate(exam.createdAt, locale)}</span>
                      </div>
                    </div>
                    <div className="history-card-footer">
                      <button
                        type="button"
                        className="history-delete-btn"
                        onClick={() => handleDeleteExam(exam.id)}
                      >
                        {t('delete', locale)}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
