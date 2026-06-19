import { useState } from 'react';
import { t } from '../lib/i18n';
import {
  submitGameErrorReport,
  type GameErrorReportContext,
  type ReportReasonId,
} from '../lib/reportError';
import type { Locale } from '../types';

const REASONS: ReportReasonId[] = [
  'answer_should_accept',
  'input_problem',
  'sheet_error',
  'other',
];

const REASON_KEYS: Record<ReportReasonId, 'reportReasonAnswer' | 'reportReasonInput' | 'reportReasonSheet' | 'reportReasonOther'> = {
  answer_should_accept: 'reportReasonAnswer',
  input_problem: 'reportReasonInput',
  sheet_error: 'reportReasonSheet',
  other: 'reportReasonOther',
};

interface ReportErrorSheetProps {
  locale: Locale;
  context: GameErrorReportContext;
  onClose: () => void;
  onSent: (viaMailto: boolean) => void;
}

export function ReportErrorSheet({ locale, context, onClose, onSent }: ReportErrorSheetProps) {
  const [selected, setSelected] = useState<Set<ReportReasonId>>(new Set(['answer_should_accept']));
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const toggle = (id: ReportReasonId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (selected.size === 0 || sending) return;
    setSending(true);
    const reasons = [...selected];
    const labels = reasons.map((r) => t(REASON_KEYS[r], locale));
    try {
      const result = await submitGameErrorReport({ reasons, comment, context }, labels);
      onSent(result === 'mailto');
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="report-error-title">
      <div className="modal-card report-error-card">
        <h3 id="report-error-title" className="modal-title">
          {t('reportErrorTitle', locale)}
        </h3>
        <p className="modal-body">{t('reportErrorIntro', locale)}</p>

        <ul className="report-error-reasons">
          {REASONS.map((id) => (
            <li key={id}>
              <label className="report-error-check">
                <input
                  type="checkbox"
                  checked={selected.has(id)}
                  onChange={() => toggle(id)}
                />
                <span>{t(REASON_KEYS[id], locale)}</span>
              </label>
            </li>
          ))}
        </ul>

        <label className="field-label" htmlFor="report-comment">
          {t('reportErrorComment', locale)}
        </label>
        <textarea
          id="report-comment"
          className="field-input report-error-comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('reportErrorCommentPh', locale)}
        />

        <p className="report-error-auto-note">{t('reportErrorAutoContext', locale)}</p>

        <button
          type="button"
          className="btn-primary btn-lg"
          disabled={selected.size === 0 || sending}
          onClick={() => void send()}
        >
          {t('reportErrorSend', locale)}
        </button>
        <button type="button" className="btn-secondary btn-lg" onClick={onClose} disabled={sending}>
          {t('cancel', locale)}
        </button>
      </div>
    </div>
  );
}
