import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../lib/i18n';
import { canOpenGamePath } from '../lib/vocabulary';
import { FormulaText } from './FormulaText';
import type { Locale, WordPair } from '../types';

interface ReviewCardsScreenProps {
  locale: Locale;
  pairs: WordPair[];
  ignored: WordPair[];
  onContinue: (pairs: WordPair[]) => void;
  onRescan: () => void;
  onBack: () => void;
}

type ReviewRow = WordPair & { id: string; added?: boolean };

function newRowId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clonePairs(pairs: WordPair[]): ReviewRow[] {
  return pairs.map((p) => ({
    ...p,
    id: newRowId(),
    quality: p.quality ?? 'trusted',
  }));
}

function toWordPair(row: ReviewRow): WordPair {
  return {
    term: row.term.trim(),
    definition: row.definition.trim(),
    termLang: row.termLang,
    defLang: row.defLang,
    visual: row.visual,
    quality: row.quality,
  };
}

export function ReviewCardsScreen({
  locale,
  pairs,
  onContinue,
  onRescan,
  onBack,
}: ReviewCardsScreenProps) {
  const [rows, setRows] = useState(() => clonePairs(pairs));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTerm, setDraftTerm] = useState('');
  const [draftDef, setDraftDef] = useState('');
  const [addError, setAddError] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const termInputRef = useRef<HTMLInputElement>(null);
  const freshTimer = useRef<number | null>(null);

  const trustedCount = rows.filter((p) => p.quality !== 'uncertain').length;
  const uncertainCount = rows.filter((p) => p.quality === 'uncertain').length;
  const playable = rows
    .map(toWordPair)
    .filter((p) => p.term && p.definition);
  const canContinue = canOpenGamePath(playable);

  const mixLabel = useMemo(
    () =>
      t('reviewCardsMix', locale)
        .replace('{n}', String(trustedCount))
        .replace('{m}', String(uncertainCount)),
    [locale, trustedCount, uncertainCount],
  );

  useEffect(() => {
    return () => {
      if (freshTimer.current) window.clearTimeout(freshTimer.current);
    };
  }, []);

  const updateRow = (id: string, patch: Partial<WordPair>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const markFresh = (id: string) => {
    if (freshTimer.current) window.clearTimeout(freshTimer.current);
    setFreshId(id);
    freshTimer.current = window.setTimeout(() => setFreshId(null), 900);
  };

  const addCard = () => {
    const term = draftTerm.trim();
    const definition = draftDef.trim();
    if (!term || !definition) {
      setAddError(true);
      termInputRef.current?.focus();
      return;
    }
    const id = newRowId();
    setRows((prev) => [...prev, { term, definition, quality: 'trusted', added: true, id }]);
    setDraftTerm('');
    setDraftDef('');
    setAddError(false);
    setEditingId(null);
    markFresh(id);
    requestAnimationFrame(() => {
      document.getElementById(`review-card-${id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
      termInputRef.current?.focus();
    });
  };

  const badgeLabel = (row: ReviewRow, unsure: boolean) => {
    if (unsure) return t('reviewCardsUncertain', locale);
    if (row.added) return t('reviewCardsAdded', locale);
    return t('reviewCardsOnSheet', locale);
  };

  return (
    <div className="screen flow-screen review-cards-screen">
      <div className="import-ambient" aria-hidden="true">
        <span className="import-ambient-orb import-ambient-orb--a" />
        <span className="import-ambient-orb import-ambient-orb--b" />
        <span className="import-ambient-orb import-ambient-orb--c" />
        <span className="import-ambient-sheen" />
      </div>
      <header className="top-bar review-cards-top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back', locale)}>
          ←
        </button>
        <h2 className="screen-title">{t('reviewCardsTitle', locale)}</h2>
        <span className="top-spacer" />
      </header>

      <main className="review-cards-main scroll-natural">
        <p className="review-cards-status" role="status">
          <span>
            {t('reviewCardsSub', locale).replace('{kept}', String(rows.length))}
          </span>
          {rows.length > 0 && (
            <>
              <span className="review-cards-status-dot" aria-hidden>
                ·
              </span>
              <span>{mixLabel}</span>
            </>
          )}
        </p>

        <form
          className="review-cards-composer"
          onSubmit={(e) => {
            e.preventDefault();
            addCard();
          }}
        >
          <p className="review-cards-composer-title">{t('reviewCardsAddTitle', locale)}</p>
          <p className="review-cards-composer-hint">{t('reviewCardsAddHint', locale)}</p>
          <div className="review-cards-composer-fields">
            <label className="review-cards-field">
              <span className="sr-only">{t('cardTermLabel', locale)}</span>
              <input
                ref={termInputRef}
                className="review-card-input"
                value={draftTerm}
                onChange={(e) => {
                  setDraftTerm(e.target.value);
                  if (addError) setAddError(false);
                }}
                placeholder={t('cardTermLabel', locale)}
                autoCapitalize="none"
                autoComplete="off"
                enterKeyHint="next"
              />
            </label>
            <label className="review-cards-field">
              <span className="sr-only">{t('cardMeaningLabel', locale)}</span>
              <input
                className="review-card-input"
                value={draftDef}
                onChange={(e) => {
                  setDraftDef(e.target.value);
                  if (addError) setAddError(false);
                }}
                placeholder={t('cardMeaningLabel', locale)}
                autoCapitalize="none"
                autoComplete="off"
                enterKeyHint="done"
              />
            </label>
            <button type="submit" className="btn-primary review-cards-add-btn">
              {t('reviewCardsAddCta', locale)}
            </button>
          </div>
          {addError && (
            <p className="review-cards-add-error" role="alert">
              {t('reviewCardsAddNeedBoth', locale)}
            </p>
          )}
        </form>

        {rows.length === 0 ? (
          <p className="review-cards-empty">{t('reviewCardsEmpty', locale)}</p>
        ) : (
          <ul className="review-cards-list">
            {rows.map((row) => {
              const unsure = row.quality === 'uncertain';
              const editing = editingId === row.id;
              return (
                <li
                  key={row.id}
                  id={`review-card-${row.id}`}
                  className={`review-card-row${freshId === row.id ? ' review-card-row--fresh' : ''}${unsure ? ' review-card-row--unsure' : ''}`}
                >
                  <div className="review-card-head">
                    {editing ? (
                      <div className="review-card-pair review-card-pair--edit">
                        <input
                          className="review-card-input"
                          value={row.term}
                          onChange={(e) => updateRow(row.id, { term: e.target.value })}
                          aria-label={t('cardTermLabel', locale)}
                          autoCapitalize="none"
                          autoComplete="off"
                        />
                        <input
                          className="review-card-input"
                          value={row.definition}
                          onChange={(e) => updateRow(row.id, { definition: e.target.value })}
                          aria-label={t('cardMeaningLabel', locale)}
                          autoCapitalize="none"
                          autoComplete="off"
                        />
                      </div>
                    ) : (
                      <div className="review-card-pair">
                        <FormulaText className="review-card-term" text={row.term} />
                        <span className="review-card-arrow" aria-hidden>
                          →
                        </span>
                        <FormulaText className="review-card-def" text={row.definition} />
                      </div>
                    )}
                    <span
                      className={`review-card-badge${
                        unsure
                          ? ' review-card-badge--bad'
                          : row.added
                            ? ' review-card-badge--new'
                            : ' review-card-badge--ok'
                      }`}
                    >
                      {badgeLabel(row, unsure)}
                    </span>
                  </div>
                  <div className="review-card-actions">
                    <button
                      type="button"
                      className={`review-card-action${editing ? ' review-card-action--on' : ''}`}
                      onClick={() => setEditingId((cur) => (cur === row.id ? null : row.id))}
                    >
                      {editing ? t('reviewCardsDone', locale) : t('reviewCardsEdit', locale)}
                    </button>
                    <button
                      type="button"
                      className={`review-card-action${unsure ? ' review-card-action--warn' : ''}`}
                      aria-pressed={unsure}
                      onClick={() =>
                        updateRow(row.id, { quality: unsure ? 'trusted' : 'uncertain' })
                      }
                    >
                      {unsure ? t('reviewCardsTrusted', locale) : t('reviewCardsUncertain', locale)}
                    </button>
                    <button
                      type="button"
                      className="review-card-action review-card-action--danger"
                      onClick={() => {
                        setRows((prev) => prev.filter((r) => r.id !== row.id));
                        if (editingId === row.id) setEditingId(null);
                      }}
                    >
                      {t('reviewCardsDelete', locale)}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <footer className="review-cards-footer">
        {!canContinue && <p className="review-cards-need">{t('reviewCardsNeedTwo', locale)}</p>}
        <button type="button" className="btn-primary btn-lg" disabled={!canContinue} onClick={() => onContinue(playable)}>
          {t('reviewCardsContinue', locale)}
        </button>
        <button type="button" className="btn-secondary btn-lg review-cards-rescan" onClick={onRescan}>
          {t('reviewCardsRescan', locale)}
        </button>
      </footer>
    </div>
  );
}
