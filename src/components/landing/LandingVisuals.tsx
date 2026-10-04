import { Logo } from '../Logo';
import { LockIcon } from '../icons/LockIcon';
import { PathGameKindIcon, type PathGameKind } from '../icons/PathGameIcons';
import { ScanPlayChest } from '../ScanPlayChest';
import { StreakFlame } from '../icons/StreakFlame';
import { lt, type LandingLang } from '../../lib/landingI18n';
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

const QUIZ_OPTIONS: { label: string; correct?: boolean; wrong?: boolean }[] = [
  { label: 'book', wrong: true },
  { label: 'dog', correct: true },
  { label: 'bird' },
  { label: 'house' },
];

export function SheetMock({ locale }: { locale: Locale }) {
  return (
    <figure className="lp-sheet" aria-hidden="true">
      <figcaption className="lp-sheet-label">{lt('lpVisualSheet', locale)}</figcaption>
      <div className="lp-sheet-paper">
        <p className="lp-sheet-title">{lt('lpMockSheetTitle', locale)}</p>
        <ul className="lp-sheet-rows">
          {SHEET_ROWS.map((row) => (
            <li key={row.term}>
              {row.marked ? <mark>{row.term}</mark> : row.term} : {row.definition}
            </li>
          ))}
        </ul>
        <span className="lp-sheet-scanline" />
        <span className="lp-sheet-flash" />
      </div>
      <span className="lp-sheet-frame" />
    </figure>
  );
}

/**
 * Slot for a real in-app capture. No gameplay screenshot or GIF exists in the
 * repo yet (`public/marketing/hero-guest-path.png` is an old path mock, not a game).
 */
export function HeroGameCapture({ lang }: { lang: LandingLang }) {
  return (
    <div className="lp-phone lp-phone--hero" aria-hidden="true">
      <div className="lp-phone-frame">
        <span className="lp-phone-island" />
        <div className="lp-phone-screen lp-phone-screen--capture">
          {/* TODO: remplacer par vraie capture app */}
          <p className="lp-capture-placeholder">{lt('lpCapturePlaceholder', lang)}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Phone looping the whole product story, synced with the sheet scan:
 * sheet read → cards generated → quiz (wrong → correction → success).
 */
export function QuizPhoneMock({ locale }: { locale: Locale }) {
  return (
    <div className="lp-phone lp-phone--hero" aria-hidden="true">
      <div className="lp-phone-frame">
        <span className="lp-phone-island" />
        <div className="lp-phone-screen lp-demo-screen">
          <div className="lp-demo-gen">
            <p className="lp-demo-gen-title">
              <span className="lp-demo-gen-spinner" />
              {lt('lpMockGenReading', locale)}
            </p>
            <span className="lp-demo-gen-bar">
              <span />
            </span>
            <ul className="lp-demo-gen-cards">
              {SHEET_ROWS.map((row, index) => (
                <li key={row.term} style={{ ['--i' as string]: String(index) }}>
                  <span>{row.term}</span>
                  <span className="lp-demo-gen-arrow">→</span>
                  <strong>{row.definition}</strong>
                </li>
              ))}
            </ul>
            <p className="lp-demo-gen-ready">
              <CheckIcon />
              {lt('lpMockGenReady', locale)}
            </p>
          </div>

          <div className="lp-mock-hud">
            <span className="lp-mock-progress">
              <span className="lp-mock-progress-fill" />
            </span>
            <span className="lp-mock-streak">
              <FlameIcon />7
            </span>
          </div>

          <div className="lp-demo-quiz">
            <p className="lp-mock-prompt">{lt('lpMockPrompt', locale)}</p>
            <p className="lp-mock-word">chien</p>
            <ul className="lp-mock-options">
              {QUIZ_OPTIONS.map((option) => {
                const stateClass = option.correct
                  ? ' lp-mock-option--answer'
                  : option.wrong
                    ? ' lp-mock-option--wrong'
                    : '';
                return (
                  <li key={option.label} className={`lp-mock-option${stateClass}`}>
                    {option.label}
                    {option.correct && <CheckIcon />}
                  </li>
                );
              })}
            </ul>
            <div className="lp-demo-error">
              <span className="lp-demo-error-mark">✕</span>
              <span className="lp-demo-error-copy">
                <strong>{lt('lpFeedbackWrong', locale)}</strong>
                <span>
                  {lt('lpFeedbackAnswer', locale)} : dog
                </span>
              </span>
            </div>
            <p className="lp-mock-xp">+10 XP</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Same curve as `buildPathD` — inlined so the landing does not import path/game modules. */
function buildLandingPathD(steps: { x: number; y: number }[]): string {
  const points = steps.map((s) => ({ x: s.x, y: s.y }));
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const midY = (prev.y + curr.y) / 2;
    d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
  }
  return d;
}

/** Phone showing the per-sheet path, with the same node marks as in the app. */
const PATH_MOCK_NODES: {
  state: 'bronze' | 'iron' | 'gold' | 'active' | 'locked';
  icon?: PathGameKind;
  x: number;
  y: number;
}[] = [
  { state: 'bronze', icon: 'quiz', x: 28, y: 12 },
  { state: 'iron', icon: 'listen', x: 72, y: 28 },
  { state: 'gold', icon: 'write', x: 28, y: 44 },
  { state: 'active', icon: 'quiz', x: 72, y: 60 },
  { state: 'locked', x: 28, y: 76 },
  { state: 'locked', x: 72, y: 90 },
];

const PATH_MOCK_D = buildLandingPathD(PATH_MOCK_NODES);

export function PathPhoneMock({ locale }: { locale: Locale }) {
  const legend = [
    { id: 'bronze', label: lt('lpPathLegendBronze', locale), cls: 'lp-path-legend-dot--bronze' },
    { id: 'iron', label: lt('lpPathLegendIron', locale), cls: 'lp-path-legend-dot--iron' },
    { id: 'gold', label: lt('lpPathLegendGold', locale), cls: 'lp-path-legend-dot--gold' },
  ] as const;

  return (
    <div className="lp-path-mock">
      <div className="lp-phone lp-phone--path" aria-hidden="true">
        <div className="lp-phone-frame">
          <span className="lp-phone-island" />
          <div className="lp-phone-screen lp-phone-screen--path">
            <div className="lp-path-banner">
              <span className="lp-path-banner-thumb">
                <Logo size={22} />
              </span>
              <span className="lp-path-banner-text">
                <span className="lp-path-banner-tag">{lt('lpMockSheetTitle', locale)}</span>
                <span className="lp-path-banner-title">{lt('lpMockPathSteps', locale)}</span>
              </span>
            </div>

            <div className="lp-path-track">
              <svg
                className="lp-path-line"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d={PATH_MOCK_D}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeDasharray="3 7"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <ol className="lp-path-nodes">
                {PATH_MOCK_NODES.map((node, index) => {
                  const done = node.state === 'bronze' || node.state === 'iron' || node.state === 'gold';
                  return (
                    <li
                      key={index}
                      className={`lp-path-node lp-path-node--${node.state}`}
                      style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    >
                      <span className="lp-path-node-dot">
                        {done && (
                          <span className="lp-path-node-flames">
                            <StreakFlame lit size={10} />
                            <StreakFlame lit size={13} />
                            <StreakFlame lit size={10} />
                          </span>
                        )}
                        {node.state === 'locked' ? (
                          <LockIcon size={16} />
                        ) : (
                          node.icon && <PathGameKindIcon kind={node.icon} size={16} />
                        )}
                        {node.state === 'active' && <span className="lp-path-node-frac">1/3</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>
      </div>

      <ul className="lp-path-legend" aria-label={lt('lpPathLegendLabel', locale)}>
        {legend.map((item) => (
          <li key={item.id}>
            <span className={`lp-path-legend-dot ${item.cls}`} aria-hidden="true" />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Small card showing streak + level, mirroring the in-app gamification HUD. */
export function ProgressCardMock({ locale }: { locale: Locale }) {
  return (
    <div className="lp-progress-card" aria-hidden="true">
      <div className="lp-progress-hud">
        <span className="lp-progress-streak">
          <StreakFlame lit size={22} />
          <strong>7</strong>
          <span>{lt('lpMockStreakLabel', locale)}</span>
        </span>
        <LevelRing level={4} size={36} />
        <ScanPlayChest size={34} />
      </div>
      <div className="lp-progress-level">
        <span className="lp-progress-level-head">
          <span>{lt('lpMockLevelLabel', locale)} 4</span>
          <span>320 XP</span>
        </span>
        <span className="lp-progress-bar">
          <span className="lp-progress-bar-fill" />
        </span>
      </div>
    </div>
  );
}

export function LevelRing({ level, size = 40 }: { level: number; size?: number }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const filled = circ * 0.68;
  return (
    <span className="lp-level-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="3.4" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="#22c55e"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <span>{level}</span>
    </span>
  );
}

/** Rank fire explained on the landing page — same flame mark as in-app. */
export function PathRanksMock({ locale }: { locale: Locale }) {
  const ranks = [
    {
      id: 'glow',
      label: lt('lpRanksGlowTitle', locale),
      body: lt('lpRanksGlowBody', locale),
      cls: 'lp-rank-node--glow',
    },
    {
      id: 'bronze',
      label: lt('lpRanksBronzeTitle', locale),
      body: lt('lpRanksBronzeBody', locale),
      cls: 'lp-rank-node--bronze',
    },
    {
      id: 'iron',
      label: lt('lpRanksIronTitle', locale),
      body: lt('lpRanksIronBody', locale),
      cls: 'lp-rank-node--iron',
    },
    {
      id: 'gold',
      label: lt('lpRanksGoldTitle', locale),
      body: lt('lpRanksGoldBody', locale),
      cls: 'lp-rank-node--gold',
    },
  ] as const;

  return (
    <ul className="lp-ranks-row">
      {ranks.map((rank) => (
        <li key={rank.id} className="lp-rank-item">
          <span className={`lp-rank-node ${rank.cls}`} aria-hidden="true">
            {rank.id !== 'glow' && (
              <span className="lp-rank-flames">
                <StreakFlame lit size={14} />
                <StreakFlame lit size={18} />
                <StreakFlame lit size={14} />
              </span>
            )}
          </span>
          <span className="lp-rank-label">{rank.label}</span>
          <span className="lp-rank-body">{rank.body}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- icons ---------- */

export function FlameIcon({ size = 16 }: { size?: number }) {
  return <StreakFlame lit size={size} />;
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
