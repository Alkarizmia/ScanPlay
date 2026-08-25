import { useMemo, useState } from 'react';
import { t } from '../lib/i18n';
import { canOpenGamePath } from '../lib/vocabulary';
import type { Locale, WordPair } from '../types';

interface ReviewCardsScreenProps {
  locale: Locale;
  pairs: WordPair[];
  ignored: WordPair[];
  onContinue: (pairs: WordPair[]) => void;
  onRescan: () => void;
  onBack: () => void;
}

function clonePairs(pairs: WordPair[]): WordPair[] {
  return pairs.map((p) => ({
    ...p,
    quality: p.quality ?? 'trusted',
  }));
}

export function ReviewCardsScreen({
  locale,
  pairs,
  ignored,
  onContinue,
  onRescan,
  onBack,
}: ReviewCardsScreenProps) {
  const [rows, setRows] = useState(() => clonePairs(pairs));
  const [editing, setEditing] = useState<number | null>(null);

  const trustedCount = rows.filter((p) => p.quality !== 'uncertain').length;
  const uncertainCount = rows.filter((p) => p.quality === 'uncertain').length;
  const canContinue = canOpenGamePath(rows);

  const mixLabel = useMemo(
    () =>
      t('reviewCardsMix', locale)
        .replace('{n}', String(trustedCount))
        .replace('{m}', String(uncertainCount + ignored.length)),
    [locale, trustedCount, uncertainCount, ignored.length],
  );

  const updateRow = (index: number, patch: Partial<WordPair>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="screen flow-screen review-cards-screen">
      <header className="top-bar review-cards-top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('back', locale)}>
          ←
        </button>
        <h2 className="screen-title">{t('reviewCardsTitle', locale)}</h2>
      </header>

      <main className="review-cards-main scroll-natural">
        <p className="review-cards-sub">
          {t('reviewCardsSub', locale)
            .replace('{kept}', String(rows.length))
            .replace('{ignored}', String(ignored.length))}
        </p>
        <p className="review-cards-mix" role="status">
          {mixLabel}
        </p>

        <ul className="review-cards-list">
          {rows.map((row, index) => {
            const unsure = row.quality === 'uncertain';
            return (
              <li key={`${row.term}-${index}`} className="review-card-row">
                <div className="review-card-pair">
                  {editing === index ? (
                    <>
                      <input
                        className="review-card-input"
                        value={row.term}
                        onChange={(e) => updateRow(index, { term: e.target.value })}
                        aria-label={t('cardTermLabel', locale)}
                      />
                      <input
                        className="review-card-input"
                        value={row.definition}
                        onChange={(e) => updateRow(index, { definition: e.target.value })}
                        aria-label={t('cardMeaningLabel', locale)}
                      />
                    </>
                  ) : (
                    <>
                      <span className="review-card-term">{row.term}</span>
                      <span className="review-card-def">{row.definition}</span>
                    </>
                  )}
                </div>
                <span className={`review-card-badge${unsure ? ' review-card-badge--bad' : ' review-card-badge--ok'}`}>
                  {unsure ? t('reviewCardsUncertain', locale) : t('reviewCardsOnSheet', locale)}
                </span>
                <div className="review-card-actions">
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setEditing((cur) => (cur === index ? null : index))}
                  >
                    {t('reviewCardsEdit', locale)}
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() =>
                      updateRow(index, { quality: unsure ? 'trusted' : 'uncertain' })
                    }
                  >
                    {unsure ? t('reviewCardsMarkSure', locale) : t('reviewCardsMarkUnsure', locale)}
                  </button>
                  <button
                    type="button"
                    className="text-link review-card-delete"
                    onClick={() => {
                      setRows((prev) => prev.filter((_, i) => i !== index));
                      setEditing(null);
                    }}
                  >
                    {t('reviewCardsDelete', locale)}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {ignored.length > 0 && (
          <section className="review-cards-ignored" aria-label={t('reviewCardsIgnored', locale)}>
            <p className="review-cards-ignored-hint">{t('reviewCardsIgnoredHint', locale)}</p>
            <ul className="review-cards-list review-cards-list--ignored">
              {ignored.map((row, index) => (
                <li key={`ign-${row.term}-${index}`} className="review-card-row review-card-row--ignored">
                  <div className="review-card-pair">
                    <span className="review-card-term">{row.term}</span>
                    <span className="review-card-def">{row.definition}</span>
                  </div>
                  <span className="review-card-badge review-card-badge--bad">{t('reviewCardsIgnored', locale)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="review-cards-footer">
        {!canContinue && <p className="review-cards-need">{t('reviewCardsNeedTwo', locale)}</p>}
        <button type="button" className="btn-secondary btn-lg" onClick={onRescan}>
          {t('reviewCardsRescan', locale)}
        </button>
        <button
          type="button"
          className="btn-primary btn-lg"
          disabled={!canContinue}
          onClick={() =>
            onContinue(
              rows
                .map((p) => ({ ...p, term: p.term.trim(), definition: p.definition.trim() }))
                .filter((p) => p.term && p.definition),
            )
          }
        >
          {t('reviewCardsContinue', locale)}
        </button>
      </footer>
    </div>
  );
}
