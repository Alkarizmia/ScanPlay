import { useState } from 'react';
import {
  CEFR_LEVELS,
  listChaptersForGoal,
  type CefrLevel,
  type EnglishGoal,
} from '../lib/englishCurriculum';
import { chapterThumb } from '../lib/englishChapterMeta';
import {
  getCurrentEnglishLesson,
  getUniverseEnglish,
  isChapterFullyDone,
  isChapterUnlocked,
  listEnglishPathLessons,
  updateUniverseEnglishProfile,
} from '../lib/universeEnglish';
import { playSound } from '../lib/sounds';
import { canPlayUniverse } from '../lib/universeHearts';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

interface EnglishCourseHubProps {
  locale: Locale;
  onPlay: (lessonId: string) => void;
  /** Open chapter skip exam in fullscreen (parent hides hub chrome). */
  onSkipChapter?: (chapterId: string) => void;
  onHeartLost?: () => void;
  refreshKey?: number;
}

const GOALS: EnglishGoal[] = ['travel', 'work', 'school', 'exam', 'fun', 'other'];

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="english-hub-edit-icon" aria-hidden="true">
      <path d="M12 20h9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EnglishCourseHub({
  locale,
  onPlay,
  onSkipChapter,
  onHeartLost,
  refreshKey = 0,
}: EnglishCourseHubProps) {
  void refreshKey;
  void onHeartLost;
  const [, setProfileRev] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [draftLevel, setDraftLevel] = useState<CefrLevel>('A1');
  const [draftGoal, setDraftGoal] = useState<EnglishGoal>('travel');

  const profile = getUniverseEnglish();
  const current = getCurrentEnglishLesson();
  const path = listEnglishPathLessons();
  const chapters = listChaptersForGoal(profile.goal);
  const titleLang = locale === 'en' ? 'en' : locale === 'nl' || locale === 'es' || locale === 'ar' ? locale : 'fr';
  const lockedHearts = !canPlayUniverse();
  const doneCount = profile.completedLessonIds.filter((id) => path.some((l) => l.id === id)).length;
  const pct = path.length > 0 ? Math.round((doneCount / path.length) * 100) : 0;
  const currentChapter = chapters.find((c) => c.lessonIds.includes(current.id)) ?? chapters[0];

  const openEdit = () => {
    setDraftLevel(profile.level);
    setDraftGoal(profile.goal);
    setEditOpen(true);
    playSound('tap');
  };

  const saveEdit = () => {
    if (draftLevel === profile.level && draftGoal === profile.goal) {
      setEditOpen(false);
      return;
    }
    updateUniverseEnglishProfile({ level: draftLevel, goal: draftGoal });
    playSound('levelUp');
    setEditOpen(false);
    setProfileRev((n) => n + 1);
  };

  return (
    <div className="english-hub">
      <section className="english-hub-hero">
        <button
          type="button"
          className="english-hub-level-edit"
          onClick={openEdit}
          aria-label={t('engEditProfile', locale)}
        >
          <PencilIcon />
        </button>
        <p className="english-hub-eyebrow">{t('engCourseTitle', locale)}</p>
        <h3 className="english-hub-title">
          {t('engHubLevel', locale).replace('{level}', profile.level)}
        </h3>
        <p className="english-hub-goal">
          {t('engHubGoal', locale).replace('{goal}', t(`engGoal_${profile.goal}` as 'engGoal_travel', locale))}
        </p>
        <div className="english-hub-meter" aria-hidden="true">
          <span className="english-hub-meter-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="english-hub-progress">
          {t('engHubProgress', locale)
            .replace('{done}', String(doneCount))
            .replace('{total}', String(Math.max(path.length, 1)))}
        </p>
      </section>

      {editOpen && (
        <div className="english-level-sheet" role="dialog" aria-labelledby="eng-edit-sheet-title">
          <div className="english-level-sheet-panel">
            <h4 id="eng-edit-sheet-title" className="english-onboard-title">
              {t('engEditProfile', locale)}
            </h4>

            <p className="english-edit-section-label">{t('engEditLevel', locale)}</p>
            <p className="english-onboard-sub">{t('engEditLevelSub', locale)}</p>
            <div className="english-level-grid">
              {CEFR_LEVELS.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  className={`english-level-chip${draftLevel === lv ? ' active' : ''}`}
                  onClick={() => {
                    playSound('tap');
                    setDraftLevel(lv);
                  }}
                >
                  {lv}
                </button>
              ))}
            </div>

            <p className="english-edit-section-label">{t('engEditGoal', locale)}</p>
            <p className="english-onboard-sub">{t('engEditGoalSub', locale)}</p>
            <div className="english-goal-list">
              {GOALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`english-goal-row${draftGoal === g ? ' active' : ''}`}
                  onClick={() => {
                    playSound('tap');
                    setDraftGoal(g);
                  }}
                >
                  {t(`engGoal_${g}` as 'engGoal_travel', locale)}
                </button>
              ))}
            </div>

            <div className="english-level-sheet-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditOpen(false)}>
                {t('cancel', locale)}
              </button>
              <button type="button" className="btn-primary" onClick={saveEdit}>
                {t('engApplyLevel', locale)}
              </button>
            </div>
          </div>
        </div>
      )}

      {currentChapter && isChapterUnlocked(chapters, chapters.findIndex((c) => c.id === currentChapter.id), profile) && (
        <section className="english-hub-chapter-card">
          <p className="english-hub-chapter-kicker">{t('engCurrentChapter', locale)}</p>
          <div className="english-hub-chapter-head">
            <span className="english-chapter-thumb" aria-hidden="true">
              {chapterThumb(currentChapter.id)}
            </span>
            <div>
              <h4 className="english-hub-chapter-name">{currentChapter.title[titleLang]}</h4>
              <p className="english-hub-chapter-meta">
                {t('engChapterLessons', locale).replace('{n}', String(currentChapter.lessonIds.length))}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary english-onboard-cta"
            disabled={lockedHearts}
            onClick={() => {
              if (lockedHearts) return;
              playSound('tap');
              onPlay(current.id);
            }}
          >
            {t('engContinue', locale).replace('{lesson}', current.title[titleLang])}
          </button>
        </section>
      )}

      <section className="english-hub-chapters" aria-label={t('engChaptersLabel', locale)}>
        {chapters.map((ch, idx) => {
          const doneInCh = ch.lessonIds.filter((id) => profile.completedLessonIds.includes(id)).length;
          const unlocked = isChapterUnlocked(chapters, idx, profile);
          const fullyDone = isChapterFullyDone(ch, profile);
          const active = ch.id === currentChapter?.id && unlocked;
          const firstOpen =
            ch.lessonIds.find((id) => !profile.completedLessonIds.includes(id)) ?? ch.lessonIds[0]!;
          const canSkip = unlocked && !fullyDone && idx < chapters.length - 1;

          return (
            <div
              key={ch.id}
              className={`english-hub-chapter-block${active ? ' active' : ''}${fullyDone ? ' done' : ''}${!unlocked ? ' locked' : ''}`}
            >
              <button
                type="button"
                className="english-hub-chapter-row"
                disabled={lockedHearts || !unlocked}
                onClick={() => {
                  if (lockedHearts || !unlocked) return;
                  playSound('tap');
                  onPlay(active ? current.id : firstOpen);
                }}
              >
                <span className="english-chapter-thumb english-chapter-thumb--sm" aria-hidden="true">
                  {chapterThumb(ch.id)}
                </span>
                <span className="english-hub-chapter-row-main">
                  <span className="english-hub-chapter-row-title">{ch.title[titleLang]}</span>
                  {!unlocked && (
                    <span className="english-hub-chapter-lock">{t('engChapterLocked', locale)}</span>
                  )}
                </span>
                <span className="english-hub-chapter-row-meta">
                  {fullyDone ? '✓' : `${doneInCh}/${ch.lessonIds.length}`}
                </span>
              </button>
              {canSkip && (
                <button
                  type="button"
                  className="english-hub-skip-btn"
                  disabled={lockedHearts}
                  onClick={() => {
                    playSound('tap');
                    onSkipChapter?.(ch.id);
                  }}
                >
                  {t('engSkipChapter', locale)}
                </button>
              )}
            </div>
          );
        })}
      </section>

      <p className="english-hub-footnote">{t('engNoHistoryNote', locale)}</p>
    </div>
  );
}
