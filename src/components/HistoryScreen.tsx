import { useMemo, useState } from 'react';
import { useDeviceProfile } from '../hooks/useDeviceProfile';
import { usePlan } from '../hooks/usePlan';
import { SynthesisActions } from './SynthesisActions';
import { getExamHistory, deleteExamHistoryEntry } from '../lib/examHistory';
import { getHistory, deleteHistoryEntry } from '../lib/history';
import { canReplayHistoryAtIndex } from '../lib/historyReplay';
import { resolveHistoryEntryMeta, getHistorySubjectLabel } from '../lib/historySubject';
import { formatHistoryDuration, formatHistoryScore } from '../lib/historyProgress';
import { getSubjectThumbMeta } from '../lib/subjectThumbnail';
import {
  HistoryChartIcon,
  HistoryClockIcon,
  HistoryDecksIcon,
  HistoryExamIcon,
  HistoryLockIcon,
  HistoryPathIcon,
  HistoryPlayIcon,
  HistoryStarIcon,
} from './icons/HistoryIcons';
import { getDateLocale, t, type TranslationKey } from '../lib/i18n';
import { resolvePathStepCount } from '../lib/stepProgress';
import type { HistoryEntry, Locale, UpgradeReason } from '../types';

interface HistoryScreenProps {
  locale: Locale;
  isLoggedIn: boolean;
  onOpenDeck: (entry: HistoryEntry) => void;
  onRescan?: () => void;
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

function averageScore(entries: HistoryEntry[]): number | null {
  const scored = entries.filter((e) => e.lastScorePct != null);
  if (scored.length === 0) return null;
  const sum = scored.reduce((acc, e) => acc + (e.lastScorePct ?? 0), 0);
  return Math.round(sum / scored.length);
}

function SubjectThumb({
  subject,
  seed,
  className = '',
}: {
  subject: Parameters<typeof getSubjectThumbMeta>[0];
  seed: string;
  className?: string;
}) {
  const art = getSubjectThumbMeta(subject, seed);
  return (
    <div
      className={`history-subject-art history-subject-art--${art.pattern}${className ? ` ${className}` : ''}`}
      style={{ background: art.gradient, ['--history-art-accent' as string]: art.accent }}
      aria-hidden="true"
    >
      <span className="history-subject-art__emoji">{art.emoji}</span>
      <span className="history-subject-art__play" />
    </div>
  );
}

export function HistoryScreen({
  locale,
  isLoggedIn,
  onOpenDeck,
  onRescan: _onRescan,
  refreshKey,
  onRefresh,
  onUpgrade,
  onToast,
  onAuth,
}: HistoryScreenProps) {
  void _onRescan;
  const [view, setView] = useState<HistoryView>('path');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const plan = usePlan(refreshKey);
  const device = useDeviceProfile();
  const isMobileGrid = device.kind === 'mobile';

  const entries = useMemo(
    () => (isLoggedIn ? getHistory() : []),
    [isLoggedIn, refreshKey],
  );
  const examEntries = useMemo(
    () => (isLoggedIn ? getExamHistory() : []),
    [isLoggedIn, refreshKey],
  );
  const avgScore = useMemo(() => averageScore(entries), [entries]);
  const visibleEntries = useMemo(() => entries.slice(0, visibleCount), [entries, visibleCount]);

  const handleOpen = (entry: HistoryEntry, index: number) => {
    if (!canReplayHistoryAtIndex(index, plan)) {
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

  const handleDeleteExam = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t('deleteConfirm', locale))) {
      deleteExamHistoryEntry(id);
      onRefresh();
    }
  };

  const tabs: { id: HistoryView; labelKey: TranslationKey; icon: 'path' | 'exam' }[] = [
    { id: 'path', labelKey: 'historyTabDecks', icon: 'path' },
    { id: 'exam', labelKey: 'historyTabExams', icon: 'exam' },
  ];

  const renderDeckCard = (entry: HistoryEntry, index: number) => {
    const meta = resolveHistoryEntryMeta(entry, locale);
    const replayLocked = !canReplayHistoryAtIndex(index, plan);
    const hasPhoto = Boolean(entry.thumbnail);

    return (
      <li
        key={entry.id}
        className={`history-grid-card${replayLocked ? ' history-grid-card--locked' : ''}`}
        style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      >
        <button
          type="button"
          className="history-thumb-delete"
          onClick={(e) => handleDelete(entry.id, e)}
          aria-label={t('delete', locale)}
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className="history-grid-visual">
          {hasPhoto ? (
            <img
              src={entry.thumbnail}
              alt=""
              className="history-grid-thumb history-grid-thumb--pixel"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <SubjectThumb subject={meta.subject} seed={entry.id} />
          )}
          <span className="history-subject-badge">{getHistorySubjectLabel(meta.subject, locale)}</span>
        </div>

        <div className="history-grid-body">
          <h4 className="history-grid-title">{meta.title}</h4>
          <div className="history-grid-meta-row">
            <p className="history-grid-date">{formatDate(entry.lastPlayedAt ?? entry.createdAt, locale)}</p>
            {entry.lastXpEarned != null && (
              <p className="history-grid-xp">
                <HistoryStarIcon className="history-inline-icon history-inline-icon--xp" />
                +{entry.lastXpEarned}
              </p>
            )}
          </div>

          <button
            type="button"
            className={`history-review-btn${replayLocked ? ' history-review-btn--locked' : ''}`}
            onClick={() => handleOpen(entry, index)}
          >
            {replayLocked ? (
              <>
                <HistoryLockIcon className="history-inline-icon" />
                {t('historyReplayLocked', locale)}
              </>
            ) : (
              <>
                <HistoryPlayIcon className="history-inline-icon" />
                {t('historyReview', locale)}
              </>
            )}
          </button>

          <div className="history-grid-synth">
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
          </div>
        </div>
      </li>
    );
  };

  if (!isLoggedIn) {
    return (
      <div className="screen tab-screen history-screen">
        <header className="history-hero">
          <h2 className="history-hero-title">{t('historyTitle', locale)}</h2>
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
          <h2 className="history-hero-title">{t('historyTitle', locale)}</h2>
          <div className="history-stats-row">
            <div className="history-stat-card">
              <span className="history-stat-icon" aria-hidden="true">
                <HistoryDecksIcon />
              </span>
              <div>
                <strong>{entries.length}</strong>
                <span>{t('historyStatScans', locale)}</span>
              </div>
            </div>
            {avgScore != null && (
              <div className="history-stat-card">
                <span className="history-stat-icon" aria-hidden="true">
                  <HistoryChartIcon />
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
              <span className="history-filter-icon" aria-hidden="true">
                {item.icon === 'path' ? <HistoryPathIcon /> : <HistoryExamIcon />}
              </span>
              {t(item.labelKey, locale)}
            </button>
          ))}
        </div>
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
                  {visibleEntries.map((entry, i) => renderDeckCard(entry, i))}
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
              <>
                <ul
                  className={`history-grid history-grid--decks${isMobileGrid ? ' history-grid--flat' : ''}`}
                >
                  {examEntries.slice(0, visibleCount).map((exam, index) => {
                    const steps = resolvePathStepCount(exam.pathStepCount);
                    const duration = formatHistoryDuration(exam.totalTimeSeconds);
                    return (
                      <li
                        key={exam.id}
                        className={`history-grid-card exam-history-card${exam.passed ? '' : ' exam-history-card--fail'}`}
                        style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                      >
                        <button
                          type="button"
                          className="history-thumb-delete"
                          onClick={(e) => handleDeleteExam(exam.id, e)}
                          aria-label={t('delete', locale)}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                        <div className="history-grid-visual">
                          {exam.thumbnail ? (
                            <img
                              src={exam.thumbnail}
                              alt=""
                              className="history-grid-thumb history-grid-thumb--pixel"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <SubjectThumb subject="general" seed={exam.id} className="history-subject-art--exam" />
                          )}
                          <span className="history-subject-badge">{t('examMode', locale)}</span>
                        </div>
                        <div className="history-grid-body">
                          <h4 className="history-grid-title">{exam.deckTitle}</h4>
                          <div className="history-grid-meta-row">
                            <p className="history-grid-date">{formatDate(exam.createdAt, locale)}</p>
                            <p className="history-grid-xp history-exam-duration">
                              <HistoryClockIcon className="history-inline-icon" />
                              {duration}
                            </p>
                          </div>
                          <p className="history-exam-meta">
                            {exam.stepGrades.length}/{steps} {t('pathUnitSteps', locale)}
                            {exam.passed ? (
                              <span className="history-exam-pass"> · {t('examFinalPassShort', locale)}</span>
                            ) : (
                              <span className="history-exam-fail"> · {t('examFinalFailShort', locale)}</span>
                            )}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {visibleCount < examEntries.length && (
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
      </main>
    </div>
  );
}
