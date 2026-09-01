import { t } from '../../lib/i18n';
import type { Locale } from '../../types';

/**
 * Static product mock-ups for the landing page.
 *
 * These deliberately do not reuse the in-app components: `GamePath` scrolls the
 * active node into view on mount and plays sounds, which would hijack the page
 * on load. Everything here is inert markup.
 */

const SHEET_ROWS: { term: string; definition: string; marked?: boolean }[] = [
  { term: 'chien', definition: 'dog', marked: true },
  { term: 'maison', definition: 'house', marked: true },
  { term: 'livre', definition: 'book' },
  { term: 'oiseau', definition: 'bird' },
];

const QUIZ_OPTIONS: { label: string; correct?: boolean }[] = [
  { label: 'book' },
  { label: 'dog', correct: true },
  { label: 'bird' },
  { label: 'house' },
];

export function SheetMock({ locale }: { locale: Locale }) {
  return (
    <figure className="lp-sheet" aria-hidden="true">
      <figcaption className="lp-sheet-label">{t('lpVisualSheet', locale)}</figcaption>
      <div className="lp-sheet-paper">
        <p className="lp-sheet-title">{t('lpMockSheetTitle', locale)}</p>
        <ul className="lp-sheet-rows">
          {SHEET_ROWS.map((row) => (
            <li key={row.term}>
              {row.marked ? <mark>{row.term}</mark> : row.term} — {row.definition}
            </li>
          ))}
        </ul>
        <span className="lp-sheet-scanline" />
      </div>
    </figure>
  );
}

/** Phone showing a quiz round — what the sheet above turns into. */
export function QuizPhoneMock({ locale }: { locale: Locale }) {
  return (
    <div className="lp-phone lp-phone--hero" aria-hidden="true">
      <div className="lp-phone-frame">
        <span className="lp-phone-island" />
        <div className="lp-phone-screen">
          <div className="lp-mock-hud">
            <span className="lp-mock-progress">
              <span className="lp-mock-progress-fill" />
            </span>
            <span className="lp-mock-streak">
              <FlameIcon />7
            </span>
          </div>

          <p className="lp-mock-prompt">{t('lpMockPrompt', locale)}</p>
          <p className="lp-mock-word">chien</p>

          <ul className="lp-mock-options">
            {QUIZ_OPTIONS.map((option) => (
              <li
                key={option.label}
                className={`lp-mock-option${option.correct ? ' is-correct' : ''}`}
              >
                {option.label}
                {option.correct && <CheckIcon />}
              </li>
            ))}
          </ul>

          <p className="lp-mock-xp">+10 XP</p>
        </div>
      </div>
    </div>
  );
}

/** Phone showing the per-sheet path of steps. */
export function PathPhoneMock({ locale }: { locale: Locale }) {
  const nodes = [
    { state: 'gold' as const },
    { state: 'gold' as const },
    { state: 'active' as const },
    { state: 'locked' as const },
    { state: 'locked' as const },
  ];

  return (
    <div className="lp-phone lp-phone--path" aria-hidden="true">
      <div className="lp-phone-frame">
        <span className="lp-phone-island" />
        <div className="lp-phone-screen lp-phone-screen--path">
          <div className="lp-path-banner">
            <span className="lp-path-banner-thumb" />
            <span className="lp-path-banner-text">
              <span className="lp-path-banner-tag">{t('lpMockSheetTitle', locale)}</span>
              <span className="lp-path-banner-title">{t('lpMockPathSteps', locale)}</span>
            </span>
          </div>

          <ol className="lp-path-nodes">
            {nodes.map((node, index) => (
              <li key={index} className={`lp-path-node lp-path-node--${node.state}`}>
                <span className="lp-path-node-dot">
                  {node.state === 'gold' && <span className="lp-path-node-star">★</span>}
                  {node.state === 'locked' ? <LockIcon /> : <PlayIcon />}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** Small card showing streak + level, mirroring the in-app gamification HUD. */
export function ProgressCardMock({ locale }: { locale: Locale }) {
  return (
    <div className="lp-progress-card" aria-hidden="true">
      <div className="lp-progress-row">
        <span className="lp-progress-flame">
          <FlameIcon />
        </span>
        <span className="lp-progress-text">
          <strong>7</strong>
          <span>{t('lpMockStreakLabel', locale)}</span>
        </span>
      </div>
      <div className="lp-progress-level">
        <span className="lp-progress-level-head">
          <span>{t('lpMockLevelLabel', locale)} 4</span>
          <span>320 XP</span>
        </span>
        <span className="lp-progress-bar">
          <span className="lp-progress-bar-fill" />
        </span>
      </div>
    </div>
  );
}

/* ---------- icons ---------- */

export function FlameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c.7 3.2-1.2 4.6-2.6 6.1C8 9.6 7 11 7 13.4A5 5 0 0 0 12 22a5 5 0 0 0 5-5.2c0-2.4-1.3-3.9-2.6-5.5-.6.8-1.3 1.3-2.1 1.5.6-2.2.6-4.4-.3-6.4-.3-.8-.7-1.6-1.2-2.3.4.3.8.6 1.2.9Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9 6.5v11a1 1 0 0 0 1.5.87l8.5-5.5a1 1 0 0 0 0-1.74l-8.5-5.5A1 1 0 0 0 9 6.5Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3a4.5 4.5 0 0 0-4.5 4.5V10H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-.5V7.5A4.5 4.5 0 0 0 12 3Zm2.5 7h-5V7.5a2.5 2.5 0 0 1 5 0V10Z" />
    </svg>
  );
}

export function CameraIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8h2l1.5-2h9L18 8h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function SparkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5 13.9 8 19.5 9.9 13.9 11.8 12 17.3 10.1 11.8 4.5 9.9 10.1 8 12 2.5ZM19 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9L19 15Z" />
    </svg>
  );
}

export function TrophyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18 4h2.5a1.5 1.5 0 0 1 1.5 1.5C22 8.5 20.2 11 17.6 11.7A6 6 0 0 1 13 15.9V18h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.1a6 6 0 0 1-4.6-4.2C3.8 11 2 8.5 2 5.5A1.5 1.5 0 0 1 3.5 4H6V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1ZM6 6H4.1c.3 1.7 1.3 3.1 2.6 3.7A16 16 0 0 1 6 7.4V6Zm12 1.4c0 .8-.1 1.6-.3 2.3 1.3-.6 2.3-2 2.6-3.7H18v1.4Z" />
    </svg>
  );
}
