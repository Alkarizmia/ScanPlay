import { getMistakes, getMistakeStats } from '../lib/mistakes';
import { t, type TranslationKey } from '../lib/i18n';
import type { GameMode, Locale } from '../types';

interface MistakesScreenProps {
  locale: Locale;
  refreshKey: number;
}

const MODE_KEYS: Record<GameMode, TranslationKey> = {
  flashcards: 'flashcards',
  quiz: 'quiz',
  match: 'match',
  type: 'modeType',
  speak: 'modeSpeak',
  listen: 'modeListen',
  truefalse: 'modeTrueFalse',
  cloze: 'modeCloze',
};

export function MistakesScreen({ locale, refreshKey }: MistakesScreenProps) {
  void refreshKey;
  const mistakes = getMistakes();
  const stats = getMistakeStats();

  return (
    <div className="screen tab-screen mistakes-screen">
      <header className="top-bar">
        <h2 className="screen-title">{t('mistakesTitle', locale)}</h2>
        <span className="mistakes-count">
          {stats.pending}/{stats.total}
        </span>
      </header>

      <main className="mistakes-main scroll-natural">
        <p className="mistakes-intro">{t('mistakesIntro', locale)}</p>

        {mistakes.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">✅</span>
            <p>{t('mistakesEmpty', locale)}</p>
          </div>
        ) : (
          <ul className="mistakes-list">
            {mistakes.map((m) => (
              <li key={m.id} className={`mistake-item ${m.corrected ? 'corrected' : ''}`}>
                <span className={`mistake-check ${m.corrected ? 'ok' : ''}`} aria-hidden="true">
                  {m.corrected ? '✓' : '·'}
                </span>
                <div className="mistake-body">
                  <span className="mistake-term">{m.term}</span>
                  <span className="mistake-def">{m.definition}</span>
                  <span className="mistake-meta">{t(MODE_KEYS[m.mode], locale)}</span>
                </div>
                <span className={`mistake-status ${m.corrected ? 'ok' : 'pending'}`}>
                  {m.corrected ? t('mistakeCorrected', locale) : t('mistakePending', locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
