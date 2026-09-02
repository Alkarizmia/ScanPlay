import type { ReactNode } from 'react';
import { t } from '../../lib/i18n';
import type { Locale } from '../../types';
import type { AnswerGrade } from '../../lib/vocabulary';

interface AnswerFeedbackProps {
  locale: Locale;
  grade: AnswerGrade | null;
  /** The expected answer, revealed on a miss. */
  answer?: ReactNode;
  /** Short pedagogical note: what the learner wrote, what was missing… */
  note?: ReactNode;
  xp?: number;
  onContinue?: () => void;
  continueLabel?: string;
  /** Opens the "report an error" sheet: the mistake may come from ScanPlay. */
  onReport?: () => void;
  /** Override the default headline (e.g. pronunciation wording). */
  title?: string;
}

const TITLE_KEY = {
  correct: 'feedbackCorrect',
  near: 'feedbackNear',
  wrong: 'feedbackWrong',
} as const;

/**
 * Shared answer banner. Every game uses it so correct / near / wrong always
 * look, sound and read the same way across ScanPlay.
 */
export function AnswerFeedback({
  locale,
  grade,
  answer,
  note,
  xp = 0,
  onContinue,
  continueLabel,
  onReport,
  title,
}: AnswerFeedbackProps) {
  if (!grade) return null;

  return (
    <div className={`answer-feedback answer-feedback--${grade}`} role="status" aria-live="polite">
      <div className="answer-feedback-main">
        <span className="answer-feedback-icon" aria-hidden="true">
          {grade === 'correct' ? '✓' : grade === 'near' ? '≈' : '✕'}
        </span>
        <div className="answer-feedback-text">
          <strong className="answer-feedback-title">{title ?? t(TITLE_KEY[grade], locale)}</strong>
          {answer != null && (
            <span className="answer-feedback-answer">
              <span className="answer-feedback-label">{t('feedbackAnswerLabel', locale)}</span>{' '}
              {answer}
            </span>
          )}
          {note != null && <span className="answer-feedback-note">{note}</span>}
        </div>
        {xp > 0 && <span className="answer-feedback-xp">+{xp} XP</span>}
      </div>

      {(onContinue || onReport) && (
        <div className="answer-feedback-actions">
          {onReport && (
            <button type="button" className="answer-feedback-report" onClick={onReport}>
              {t('reportErrorBtn', locale)}
            </button>
          )}
          {onContinue && (
            <button type="button" className="btn-primary answer-feedback-cta" onClick={onContinue}>
              {continueLabel ?? t('lessonContinue', locale)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
