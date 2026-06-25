import { useMemo, useState } from 'react';
import { useDeviceProfile } from '../hooks/useDeviceProfile';
import { usePlan } from '../hooks/usePlan';
import { SynthesisActions } from './SynthesisActions';
import { getExamHistory, deleteExamHistoryEntry } from '../lib/examHistory';
import { getHistory, deleteHistoryEntry } from '../lib/history';
import { canReplayHistoryEntry } from '../lib/historyReplay';
import { resolveHistoryEntryMeta, getHistorySubjectLabel } from '../lib/historySubject';
import { formatHistoryDuration, formatHistoryScore, getHistoryPathProgress } from '../lib/historyProgress';
import { getHistoryCardThumbnail } from '../lib/subjectThumbnail';
import { getDateLocale, t, type TranslationKey } from '../lib/i18n';
import { resolvePathStepCount } from '../lib/stepProgress';
import type { HistoryEntry, Locale, UpgradeReason } from '../types';

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

type HistoryView = 'path' | 'exam';

const PAGE_SIZE = 6;

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(getDateLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDayLabel(iso: string, locale: Locale): string {
  const date = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startToday.getTime() - startDate.getTime()) / 86400000);

  if (diffDays === 0) return t('historyGroupToday', locale);
  if (diffDays === 1) return t('historyGroupYesterday', locale);
  return date.toLocaleDateString(getDateLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function groupEntriesByDay(entries: HistoryEntry[], locale: Locale) {
  const groups: { label: string; entries: HistoryEntry[] }[] = [];
  for (const entry of entries) {
    const label = formatDayLabel(entry.lastPlayedAt ?? entry.createdAt, locale);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}

function averageScore(entries: HistoryEntry[]): number | null {
  const scored = entries.filter((e) => e.lastScorePct != null);
  if (scored.length === 0) return null;
  const sum = scored.reduce((acc, e) => acc + (e.lastScorePct ?? 0), 0);
  return Math.round(sum / scored.length);
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
  const [view, setView] = useState<HistoryView>('path');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const entries = isLoggedIn ? getHistory() : [];
  const examEntries = isLoggedIn ? getExamHistory() : [];
  const plan = usePlan(refreshKey);
  const device = useDeviceProfile();
  const isMobileGrid = device.kind === 'mobile';
  const avgScore = averageScore(entries);

  const visibleEntries = entries.slice(0, visibleCount);
  const grouped = useMemo(() => groupEntriesByDay(visibleEntries, locale), [visibleEntries, locale]);

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

  const tabs: { id: HistoryView; labelKey: TranslationKey; icon: string }[] = [
    { id: 'path', labelKey: 'historyTabDecks', icon: '📋' },
    { id: 'exam', labelKey: 'historyTabExams', icon: '🎓' },
  ];

  const renderDeckCard = (entry: HistoryEntry) => {
    const meta = resolveHistoryEntryMeta(entry, locale);
    const thumb = getHistoryCardThumbnail(meta.subject, entry.id, entry.thumbnail);
    const replayLocked = !canReplayHistoryEntry(entry.id, plan);
    const scorePct = entry.lastScorePct;
    const pathProgress = getHistoryPathProgress(entry);
    const pathPct = Math.round(pathProgress.fraction * 100);

    return (
      <li
        key={entry.id}
        className={`history-grid-card${replayLocked ? ' history-grid-card--locked' : ''}`}
      >
        <div className="history-grid-visual">
          {thumb ? (
            <img src={thumb} alt="" className="history-grid-thumb" />
          ) : (
            <div className="history-grid-thumb history-grid-thumb--fallback">📄</div>
          )}
          {scorePct != null && (
            <span className="history-score-badge">{formatHistoryScore(scorePct)}</span>
          )}
          <span className="history-subject-badge">{getHistorySubjectLabel(meta.subject, locale)}</span>
        </div>

        <div className="history-grid-body">
          <h4 className="history-grid-title">{meta.title}</h4>
          <p className="history-grid-date">{formatDate(entry.lastPlayedAt ?? entry.createdAt, locale)}</p>
          {entry.lastXpEarned != null && (
            <p className="history-grid-xp">
              <span aria-hidden="true">⭐</span> +{entry.lastXpEarned} XP
            </p>
          )}

          <button
            type="button"
            className={`history-review-btn${replayLocked ? ' history-review-btn--locked' : ''}`}
            onClick={() => handleOpen(entry)}
          >
            {replayLocked ? (
              <>🔒 {t('historyReplayLocked', locale)}</>
            ) : (
              <>
                <span className="history-review-play" aria-hidden="true">
                  ▶
                </span>
                {t('historyReview', locale)}
              </>
            )}
          </button>

          <div
            className="history-path-progress"
            role="progressbar"
            aria-valuenow={pathPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('historyPathProgress', locale)
              .replace('{done}', String(pathProgress.doneSteps))
              .replace('{total}', String(pathProgress.totalSteps))}
          >
            <div className="history-path-progress-track">
              <div
                className={`history-path-progress-fill${pathProgress.complete ? ' history-path-progress-fill--complete' : ''}`}
                style={{ width: `${pathPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="history-grid-footer">
          <SynthesisActions
            locale={locale}
            pairs={entry.pairs}
            thumbnail={entry.thumbnail}
            title={meta.title}
            sheetType={entry.sheetType}
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
  };

  if (!isLoggedIn) {
    return (
      <div className="screen tab-screen history-screen">
        <header className="history-hero">
          <h2 className="history-hero-title">{t('historyTitle', locale)}</h2>
          <p className="history-hero-sub">{t('historyHeroSub', locale)}</p>
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
    <div className="screen tab-screen history-screen">
      <header className="history-hero">
        <div className="history-hero-top">
          <div>
            <h2 className="history-hero-title">{t('historyTitle', locale)}</h2>
            <p className="history-hero-sub">{t('historyHeroSub', locale)}</p>
          </div>
          <div className="history-stats-row">
            <div className="history-stat-card">
              <span className="history-stat-icon" aria-hidden="true">
                📚
              </span>
              <div>
                <strong>{entries.length}</strong>
                <span>{t('historyStatScans', locale)}</span>
              </div>
            </div>
            {avgScore != null && (
              <div className="history-stat-card">
                <span className="history-stat-icon" aria-hidden="true">
                  📈
                </span>
                <div>
                  <strong>{formatHistoryScore(avgScore)}</strong>
                  <span>{t('historyStatAverage', locale)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="history-filter-row history-filter-row--tabs">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`history-filter-chip${view === item.id ? ' active' : ''}`}
              onClick={() => {
                setView(item.id);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              <span aria-hidden="true">{item.icon}</span>
              {t(item.labelKey, locale)}
            </button>
          ))}
        </div>

        {view === 'path' && (
          <p className="history-replay-hint">{t('historyReplayLimitHint', locale)}</p>
        )}
      </header>

      <main className="history-main scroll-natural">
        {view === 'path' && (
          <>
            {entries.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📋</span>
                <p>{t('historyEmpty', locale)}</p>
                <p className="empty-hint">{t('historyEmptyHint', locale)}</p>
              </div>
            ) : (
              <>
                <ul
                  className={`history-grid history-grid--decks${isMobileGrid ? ' history-grid--flat' : ''}`}
                >
                  {isMobileGrid
                    ? visibleEntries.map((entry) => renderDeckCard(entry))
                    : grouped.flatMap((group) => [
                        <li key={`day-${group.label}`} className="history-day-heading">
                          <h3 className="history-day-label">{group.label}</h3>
                        </li>,
                        ...group.entries.map((entry) => renderDeckCard(entry)),
                      ])}
                </ul>

                {visibleCount < entries.length && (
                  <button
                    type="button"
                    className="history-load-more"
                    onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  >
                    {t('historyLoadMore', locale)}
                    <span aria-hidden="true">⌄</span>
                  </button>
                )}
              </>
            )}
          </>
        )}

        {view === 'exam' && (
          <>
            {examEntries.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🎓</span>
                <p>{t('examHistoryEmpty', locale)}</p>
                <p className="empty-hint">{t('examHistoryEmptyHint', locale)}</p>
              </div>
            ) : (
              <ul
                className={`history-grid history-grid--decks${isMobileGrid ? ' history-grid--flat' : ''}`}
              >
                {examEntries.map((exam) => {
                  const steps = resolvePathStepCount(exam.pathStepCount);
                  const duration = formatHistoryDuration(exam.totalTimeSeconds);
                  return (
                    <li
                      key={exam.id}
                      className={`history-grid-card exam-history-card${exam.passed ? '' : ' exam-history-card--fail'}`}
                    >
                      <div className="history-grid-visual">
                        {exam.thumbnail ? (
                          <img src={exam.thumbnail} alt="" className="history-grid-thumb" />
                        ) : (
                          <div className="history-grid-thumb history-grid-thumb--fallback">🎓</div>
                        )}
                        <span
                          className={`history-score-badge${exam.passed ? '' : ' history-score-badge--fail'}`}
                        >
                          {formatHistoryScore(exam.finalGrade)}
                        </span>
                        <span className="history-subject-badge">{t('examMode', locale)}</span>
                      </div>
                      <div className="history-grid-body">
                        <h4 className="history-grid-title">{exam.deckTitle}</h4>
                        <p className="history-grid-date">{formatDate(exam.createdAt, locale)}</p>
                        <p className="history-grid-xp history-exam-duration">
                          <span aria-hidden="true">⏱️</span>{' '}
                          {t('historyExamPathTime', locale).replace('{time}', duration)}
                        </p>
                        <p className="history-exam-meta">
                          {exam.stepGrades.length}/{steps} {t('pathUnitSteps', locale)}
                          {exam.passed ? (
                            <span className="history-exam-pass"> · {t('examFinalPassShort', locale)}</span>
                          ) : (
                            <span className="history-exam-fail"> · {t('examFinalFailShort', locale)}</span>
                          )}
                        </p>
                      </div>
                      <div className="history-grid-footer">
                        <button
                          type="button"
                          className="history-delete-btn"
                          onClick={() => handleDeleteExam(exam.id)}
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
      </main>
    </div>
  );
}
