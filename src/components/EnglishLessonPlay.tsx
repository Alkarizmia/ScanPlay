import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  completeEnglishLesson,
  getEnglishLessonPairs,
  getUniverseEnglish,
  recordUniverseWeakSuccess,
  recordUniverseWeakWord,
  setEnglishCurrentLesson,
  setEnglishLessonStep,
} from '../lib/universeEnglish';
import { ENGLISH_LESSONS } from '../lib/englishCurriculum';
import { hasDialogueForLesson } from '../lib/englishDialogues';
import { hasEnoughImagePickPairs } from '../lib/imagePickRounds';
import { buildListenPickRounds } from '../lib/listenPickRounds';
import { buildLocalTranslateRounds } from '../lib/translateRounds';
import { canPlayUniverse, loseUniverseHeart } from '../lib/universeHearts';
import { applyXpDelta } from '../lib/gamification';
import {
  getGameHudSnapshot,
  resetGameHud,
  setGameHudPracticeMode,
} from '../lib/gameFeedback';
import { playSound } from '../lib/sounds';
import { t } from '../lib/i18n';
import type { CefrLevel, EnglishGoal } from '../lib/englishCurriculum';
import type { GameCompleteMeta, Locale, WordPair } from '../types';
import { gameProgressPct, GameHeader } from './games/GameHeader';
import { UniverseOutOfHearts } from './UniverseOutOfHearts';
import { ScanPlayMascot } from './mascot/ScanPlayMascot';

const ListenPickGame = lazy(() =>
  import('./games/ListenPickGame').then((m) => ({ default: m.ListenPickGame })),
);
const SpeakGame = lazy(() => import('./games/SpeakGame').then((m) => ({ default: m.SpeakGame })));
const QuizGame = lazy(() => import('./games/QuizGame').then((m) => ({ default: m.QuizGame })));
const TypeGame = lazy(() => import('./games/TypeGame').then((m) => ({ default: m.TypeGame })));
const ImagePickGame = lazy(() =>
  import('./games/ImagePickGame').then((m) => ({ default: m.ImagePickGame })),
);
const TranslateGame = lazy(() =>
  import('./games/TranslateGame').then((m) => ({ default: m.TranslateGame })),
);
const DialogueListenGame = lazy(() =>
  import('./games/DialogueListenGame').then((m) => ({ default: m.DialogueListenGame })),
);

type StepKind =
  | 'listen'
  | 'speak'
  | 'quiz'
  | 'type'
  | 'image'
  | 'translate'
  | 'story'
  | 'mood'
  | 'fact';

/** Review formats: typing first, then MCQ, then listen-pick if still missed. */
type ReviewMode = 'type' | 'quiz' | 'listen';

function reviewModeForFails(fails: number): ReviewMode {
  if (fails <= 0) return 'type';
  if (fails === 1) return 'quiz';
  return 'listen';
}

function pairKey(pair: WordPair): string {
  return pair.term.trim().toLowerCase();
}

interface MixStep {
  kind: StepKind;
  focus: WordPair;
  /** Salt for dialogue bank variety (story/mood/fact). */
  dialogueSalt?: number;
}

interface EnglishLessonPlayProps {
  locale: Locale;
  lessonId: string;
  onExit: () => void;
  onHeartLost: () => void;
  /** Jump straight into the next Universe lesson. */
  onPlayNext: (lessonId: string) => void;
}

function uniqPairs(list: WordPair[]): WordPair[] {
  const seen = new Set<string>();
  const out: WordPair[] = [];
  for (const p of list) {
    const key = p.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function canPlayKind(
  kind: StepKind,
  focus: WordPair,
  pool: WordPair[],
  level?: CefrLevel,
  goal?: EnglishGoal,
): boolean {
  if (kind === 'image') return hasEnoughImagePickPairs([focus]);
  // Listen-pick needs ≥4 short bilingual candidates in the lesson pool, else rounds = [].
  if (kind === 'listen')
    return buildListenPickRounds(pool, { maxRounds: 1, answerField: 'term' }).length >= 1;
  if (kind === 'translate') return buildLocalTranslateRounds(pool, 1).length >= 1;
  if (kind === 'story' || kind === 'mood' || kind === 'fact') {
    return !!level && !!goal && hasDialogueForLesson(level, goal);
  }
  return true;
}

function fallbackKind(
  prev: StepKind | undefined,
  focus: WordPair,
  pool: WordPair[],
  level?: CefrLevel,
  goal?: EnglishGoal,
): StepKind {
  const candidates: StepKind[] = ['image', 'quiz', 'type', 'translate', 'speak', 'listen'];
  for (const kind of candidates) {
    if (kind === prev) continue;
    if (canPlayKind(kind, focus, pool, level, goal)) return kind;
  }
  return prev === 'quiz' ? 'type' : 'quiz';
}

/** Duolingo-style: alternate exercise types, never a block of the same kind. */
function buildMixedSteps(
  pairs: WordPair[],
  lessonId: string,
  level: CefrLevel,
  goal: EnglishGoal,
): MixStep[] {
  /* Image pick (Fluent emoji) early in the mix so everyday vocab gets the 4-choice game. */
  const rotation: StepKind[] = ['quiz', 'image', 'listen', 'translate', 'speak', 'type', 'image', 'quiz'];
  const steps: MixStep[] = [];
  let rot = lessonId.length % rotation.length;
  let pictureableSeen = 0;

  for (const focus of pairs) {
    const pictureable = hasEnoughImagePickPairs([focus]);
    let attempts = 0;
    let kind = rotation[rot % rotation.length]!;

    /* Prefer Image Pick for ~half of pictureable words (Univers English). */
    if (pictureable && pictureableSeen % 2 === 0 && steps[steps.length - 1]?.kind !== 'image') {
      kind = 'image';
    }

    while (attempts < rotation.length && !canPlayKind(kind, focus, pairs, level, goal)) {
      rot += 1;
      kind = rotation[rot % rotation.length]!;
      attempts += 1;
    }
    if (!canPlayKind(kind, focus, pairs, level, goal)) {
      kind = fallbackKind(undefined, focus, pairs, level, goal);
    }
    const prev = steps[steps.length - 1]?.kind;
    if (prev === kind) {
      rot += 1;
      kind = rotation[rot % rotation.length]!;
      if (!canPlayKind(kind, focus, pairs, level, goal) || kind === prev) {
        kind = fallbackKind(prev, focus, pairs, level, goal);
      }
    }
    if (pictureable) pictureableSeen += 1;
    steps.push({ kind, focus });
    rot += 1;
  }

  const extraKinds: StepKind[] = ['image', 'type', 'quiz'];
  for (let i = 0; i < Math.min(3, pairs.length); i += 1) {
    const focus = pairs[(i * 3) % pairs.length]!;
    let kind = extraKinds[i % extraKinds.length]!;
    if (!canPlayKind(kind, focus, pairs, level, goal) || steps[steps.length - 1]?.kind === kind) {
      kind = fallbackKind(steps[steps.length - 1]?.kind, focus, pairs, level, goal);
    }
    steps.push({ kind, focus });
  }

  // 1–2 mini-conversation listen games (static bank, browser TTS — no AI tokens).
  if (pairs.length > 0 && hasDialogueForLesson(level, goal)) {
    const anchor = pairs[lessonId.length % pairs.length]!;
    const dialogueKinds: StepKind[] = ['story', 'mood', 'fact'];
    const first = dialogueKinds[lessonId.length % 3]!;
    const second = dialogueKinds[(lessonId.length + 1) % 3]!;
    steps.push({ kind: first, focus: anchor, dialogueSalt: 0 });
    if (pairs.length >= 4) {
      steps.push({ kind: second, focus: pairs[(lessonId.length + 2) % pairs.length]!, dialogueSalt: 1 });
    }
  }

  return steps;
}

export function EnglishLessonPlay({
  locale,
  lessonId,
  onExit,
  onHeartLost,
  onPlayNext,
}: EnglishLessonPlayProps) {
  const profile = getUniverseEnglish();
  const lesson = ENGLISH_LESSONS.find((l) => l.id === lessonId);
  const pairs = useMemo(
    () => getEnglishLessonPairs(lessonId, profile.nativeLang),
    [lessonId, profile.nativeLang],
  );
  const steps = useMemo(
    () => buildMixedSteps(pairs, lessonId, profile.level, profile.goal),
    [pairs, lessonId, profile.level, profile.goal],
  );
  const [stepIndex, setStepIndex] = useState(() => {
    const saved = getUniverseEnglish();
    if (saved.currentLessonId !== lessonId) return 0;
    return Math.max(0, saved.lessonStepIndex || 0);
  });
  const [phase, setPhase] = useState<'play' | 'review' | 'done'>('play');
  /** Snapshot of every missed word for this lesson (order preserved). */
  const [reviewQueue, setReviewQueue] = useState<WordPair[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  /** Extra fails during review → switch game format (type → quiz → listen). */
  const [reviewFails, setReviewFails] = useState<Record<string, number>>({});
  /** Remount key when format or item changes. */
  const [reviewNonce, setReviewNonce] = useState(0);
  const [nextLessonId, setNextLessonId] = useState<string | null>(null);
  /** Unique words missed on the main path (review retries do not add to this). */
  const playMissKeysRef = useRef<Set<string>>(new Set());
  const [resultStats, setResultStats] = useState<{
    total: number;
    errors: number;
    xpDelta: number;
    bestCombo: number;
  }>({
    total: 0,
    errors: 0,
    xpDelta: 0,
    bestCombo: 0,
  });
  const weakRef = useRef<WordPair[]>([]);

  useEffect(() => {
    resetGameHud();
    return () => {
      setGameHudPracticeMode(false);
    };
  }, [lessonId]);

  useEffect(() => {
    const saved = getUniverseEnglish();
    let start = 0;
    if (saved.currentLessonId === lessonId) {
      start = Math.max(0, saved.lessonStepIndex || 0);
    }
    if (steps.length > 0 && start >= steps.length) start = 0;
    setStepIndex(start);
    setEnglishLessonStep(lessonId, start);
  }, [lessonId, steps.length]);

  const loseHeart = () => {
    const { lost } = loseUniverseHeart();
    if (lost) onHeartLost();
  };

  const markWrong = (pair: WordPair, opts?: { review?: boolean }) => {
    weakRef.current = uniqPairs([...weakRef.current, pair]);
    recordUniverseWeakWord(pair.term);
    // Hearts + grade only during the main path — review is practice, not a second penalty.
    if (!opts?.review) {
      playMissKeysRef.current.add(pairKey(pair));
      loseHeart();
    }
  };

  const markRight = (pair: WordPair) => {
    recordUniverseWeakSuccess(pair.term);
  };

  const finishLesson = () => {
    setGameHudPracticeMode(false);
    const total = Math.max(1, steps.length);
    const errors = Math.min(playMissKeysRef.current.size, total);
    const hud = getGameHudSnapshot();
    // Credit the live HUD total once (combo gains + level-scaled misses). Never during play.
    const { applied } = applyXpDelta(hud.xp);
    setResultStats({
      total,
      errors,
      xpDelta: applied,
      bestCombo: hud.bestCombo,
    });
    setEnglishCurrentLesson(lessonId);
    const after = completeEnglishLesson(lessonId);
    const nextId = after.currentLessonId !== lessonId ? after.currentLessonId : null;
    setNextLessonId(nextId);
    playSound(applied >= 0 ? 'perfect' : 'whoosh');
    setPhase('done');
  };

  const startReview = (weak: WordPair[]) => {
    // Review is practice: keep the path HUD score frozen for the final grant.
    setGameHudPracticeMode(true);
    playSound('whoosh');
    setReviewQueue(weak);
    setReviewIndex(0);
    setReviewFails({});
    setReviewNonce((n) => n + 1);
    setPhase('review');
  };

  const advanceStep = () => {
    if (stepIndex + 1 >= steps.length) {
      const weak = uniqPairs(weakRef.current);
      if (weak.length === 0) {
        finishLesson();
        return;
      }
      startReview(weak);
      return;
    }
    // Continuer / Terminer: whoosh only (correct/wrong already played on the answer).
    playSound('whoosh');
    const next = stepIndex + 1;
    setStepIndex(next);
    setEnglishLessonStep(lessonId, next);
  };

  /** Set on the latest review grade so Continuer can switch format without remounting mid-feedback. */
  const reviewMissedRef = useRef(false);

  const onReviewAnswer = (pair: WordPair, correct: boolean) => {
    const expected = reviewQueue[reviewIndex];
    // Only grade the word currently under review — never swap in another lemma.
    if (expected && pairKey(pair) !== pairKey(expected)) {
      reviewMissedRef.current = true;
      return;
    }
    if (correct) {
      reviewMissedRef.current = false;
      markRight(pair);
      weakRef.current = weakRef.current.filter((p) => pairKey(p) !== pairKey(pair));
      return;
    }
    reviewMissedRef.current = true;
    // Hearts already lost in the main path — review never costs another heart.
    markWrong(pair, { review: true });
  };

  /** After Continuer on a review item: retry same word with a new format, or go next. */
  const onReviewItemComplete = () => {
    const current = reviewQueue[reviewIndex];
    if (!current) {
      finishLesson();
      return;
    }
    if (reviewMissedRef.current) {
      reviewMissedRef.current = false;
      const key = pairKey(current);
      // Same word, different game — helps stick the correction.
      playSound('whoosh');
      setReviewFails((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
      setReviewNonce((n) => n + 1);
      return;
    }
    // Cleared this word — advance through the original miss list, skipping already fixed.
    let nextIdx = reviewIndex + 1;
    while (
      nextIdx < reviewQueue.length &&
      !weakRef.current.some((p) => pairKey(p) === pairKey(reviewQueue[nextIdx]!))
    ) {
      nextIdx += 1;
    }
    if (nextIdx >= reviewQueue.length) {
      const leftover = uniqPairs(weakRef.current);
      if (leftover.length === 0) {
        finishLesson();
        return;
      }
      // Safety: anything still weak (shouldn't happen often) gets another pass.
      startReview(leftover);
      return;
    }
    playSound('whoosh');
    setReviewIndex(nextIdx);
    setReviewNonce((n) => n + 1);
  };

  const onStepScored = (focus: WordPair, score: number, total: number, meta?: GameCompleteMeta) => {
    if (meta?.technical) {
      advanceStep();
      return;
    }
    if (score < total) markWrong(focus);
    else markRight(focus);
    advanceStep();
  };

  if (!lesson || pairs.length === 0 || steps.length === 0) {
    return (
      <div className="english-play">
        <p>{t('engLessonMissing', locale)}</p>
        <button type="button" className="btn-secondary" onClick={onExit}>
          {t('back', locale)}
        </button>
      </div>
    );
  }

  /* Review is practice: never block it when hearts are empty (no second penalty). */
  if (!canPlayUniverse() && phase === 'play') {
    return (
      <div className="english-play english-play--game">
        <UniverseOutOfHearts locale={locale} onBack={onExit} />
      </div>
    );
  }

  if (phase === 'done') {
    const totalEx = Math.max(1, resultStats.total || steps.length);
    const errors = Math.min(resultStats.errors, totalEx);
    const ok = Math.max(0, totalEx - errors);
    const scorePct = Math.round((ok / totalEx) * 100);
    const band = errors === 0 ? 'great' : scorePct >= 75 ? 'pass' : scorePct >= 50 ? 'close' : 'fail';
    const noteText =
      errors === 0
        ? t('engResultNoteOk', locale).replace('{total}', String(totalEx))
        : t('engResultNote', locale)
            .replace('{bad}', String(errors))
            .replace('{total}', String(totalEx));

    return (
      <div className="english-play english-play--game">
        <div className={`english-lesson-done english-lesson-done--${band}`} role="status">
          <div className="english-lesson-done-bg" aria-hidden="true">
            <span className="english-lesson-done-orb english-lesson-done-orb--a" />
            <span className="english-lesson-done-orb english-lesson-done-orb--b" />
            <span className="english-lesson-done-burst" />
          </div>
          <div className="english-lesson-done-panel">
            <div className="english-lesson-done-mascot" aria-hidden="true">
              <ScanPlayMascot
                expression={band === 'fail' || band === 'close' ? 'encouraging' : 'celebrating'}
                size={132}
                idle
                celebrate={band === 'great' || band === 'pass'}
                preferAsset
              />
            </div>
            <p
              className={`english-lesson-done-xp${resultStats.xpDelta < 0 ? ' english-lesson-done-xp--loss' : ''}`}
            >
              {resultStats.xpDelta > 0 ? '+' : ''}
              {resultStats.xpDelta} XP
            </p>
            {resultStats.bestCombo >= 2 && (
              <span className="game-hud-chip game-hud-chip--combo english-lesson-done-combo">
                ×{resultStats.bestCombo}
              </span>
            )}
            <h3 className="english-lesson-done-title">{t('engLessonComplete', locale)}</h3>
            <div
              className="english-lesson-done-score-ring"
              style={{ ['--score-pct' as string]: `${scorePct}%` }}
            >
              <div className="english-lesson-done-score-inner">
                <p className="english-lesson-done-score-text">
                  <span className="english-lesson-done-score-num">{ok}</span>
                  <span className="english-lesson-done-score-den">/{totalEx}</span>
                </p>
              </div>
            </div>
            <p className={`english-lesson-done-note english-lesson-done-note--${band}`}>{noteText}</p>
            {nextLessonId ? (
              <button
                type="button"
                className="btn-primary btn-lg english-lesson-done-cta"
                onClick={() => {
                  playSound('tap');
                  onPlayNext(nextLessonId);
                }}
              >
                {t('engContinueNextLesson', locale)}
              </button>
            ) : (
              <p className="english-lesson-done-next-label">{t('engPathCaughtUp', locale)}</p>
            )}
            <button
              type="button"
              className="english-lesson-done-exit"
              onClick={() => {
                playSound('tap');
                onExit();
              }}
            >
              {t('engBackToUniverse', locale)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const step = steps[stepIndex];
  const totalUnits = steps.length + 1;
  const reviewPair = reviewQueue[reviewIndex];
  const reviewFailCount = reviewPair ? (reviewFails[pairKey(reviewPair)] ?? 0) : 0;
  const reviewPool = reviewPair ? uniqPairs([reviewPair, ...pairs]) : pairs;
  let reviewMode = reviewModeForFails(reviewFailCount);
  // Listen-pick for THIS word only; otherwise keep drilling with MCQ.
  if (
    reviewMode === 'listen' &&
    reviewPair &&
    buildListenPickRounds(reviewPool, {
      maxRounds: 1,
      answerField: 'term',
      focusPair: reviewPair,
    }).length < 1
  ) {
    reviewMode = 'quiz';
  }
  const progress =
    phase === 'review'
      ? gameProgressPct(reviewIndex, Math.max(reviewQueue.length, 1))
      : gameProgressPct(stepIndex, totalUnits);
  const stepPool = step ? uniqPairs([step.focus, ...pairs]) : pairs;

  return (
    <div className="english-play english-play--game">
      {/* One ScanPlay ✕ + one chromatic bar; games are embedded (no second chrome). */}
      <GameHeader locale={locale} onExit={onExit} progress={progress} />
      {phase === 'review' && reviewPair && (
        <div className="english-review-banner" role="status">
          <span className="english-review-banner-icon" aria-hidden="true">
            !
          </span>
          <div className="english-review-banner-text">
            <strong className="english-review-banner-title">{t('engReviewTitle', locale)}</strong>
            <span className="english-review-banner-sub">
              {reviewFailCount > 0
                ? t('engReviewRetry', locale)
                : t('engReviewSub', locale)
                    .replace('{n}', String(reviewQueue.length))
                    .replace('{i}', String(reviewIndex + 1))}
            </span>
          </div>
        </div>
      )}
      <Suspense fallback={<div className="screen-loading" aria-busy="true" />}>
        {phase === 'play' && step?.kind === 'listen' && (
          <ListenPickGame
            pairs={stepPool}
            locale={locale}
            maxItems={1}
            embedded
            answerField="term"
            deckId={`eng-mix-listen-${lessonId}-${stepIndex}`}
            onAnswer={(pair, correct) => {
              if (correct) markRight(pair);
              else markWrong(pair);
            }}
            onComplete={() => advanceStep()}
            onExit={onExit}
          />
        )}
        {phase === 'play' && step?.kind === 'speak' && (
          <SpeakGame
            pairs={[step.focus]}
            locale={locale}
            maxItems={1}
            embedded
            deckId={`eng-mix-speak-${lessonId}-${stepIndex}`}
            onComplete={(score, total, meta) => onStepScored(step.focus, score, total, meta)}
            onExit={onExit}
          />
        )}
        {phase === 'play' && step?.kind === 'quiz' && (
          <QuizGame
            pairs={stepPool}
            locale={locale}
            maxItems={1}
            embedded
            targetSide="term"
            shuffleSeed={`eng-mix-quiz-${lessonId}-${stepIndex}`}
            onAnswer={(pair, correct) => {
              if (correct) markRight(pair);
              else markWrong(pair);
            }}
            onComplete={() => advanceStep()}
            onExit={onExit}
          />
        )}
        {phase === 'play' && step?.kind === 'type' && (
          <TypeGame
            key={`eng-type-${lessonId}-${stepIndex}`}
            pairs={[step.focus]}
            locale={locale}
            maxItems={1}
            embedded
            targetSide="term"
            onAnswer={(pair, correct) => {
              if (correct) markRight(pair);
              else markWrong(pair);
            }}
            onComplete={() => advanceStep()}
            onExit={onExit}
          />
        )}
        {phase === 'play' && step?.kind === 'image' && (
          <ImagePickGame
            /* Focus word first: distractors come from Fluent catalog, not other lesson terms. */
            pairs={[step.focus]}
            locale={locale}
            maxItems={1}
            embedded
            deckId={`eng-mix-img-${lessonId}-${stepIndex}`}
            onComplete={(score, total) => onStepScored(step.focus, score, total)}
            onExit={onExit}
          />
        )}
        {phase === 'play' && step?.kind === 'translate' && (
          <TranslateGame
            pairs={stepPool}
            locale={locale}
            maxItems={1}
            embedded
            deckId={`eng-mix-tr-${lessonId}-${stepIndex}`}
            onComplete={(score, total) => onStepScored(step.focus, score, total)}
            onExit={onExit}
            onNotEnoughPairs={() => advanceStep()}
          />
        )}
        {phase === 'play' &&
          (step?.kind === 'story' || step?.kind === 'mood' || step?.kind === 'fact') && (
            <DialogueListenGame
              locale={locale}
              nativeLang={profile.nativeLang}
              lessonId={lessonId}
              level={profile.level}
              goal={profile.goal}
              mode={step.kind === 'story' ? 'topic' : step.kind}
              salt={step.dialogueSalt ?? 0}
              embedded
              onAnswer={(correct) => {
                if (correct) markRight(step.focus);
                else markWrong(step.focus);
              }}
              onComplete={() => advanceStep()}
              onExit={onExit}
            />
          )}
        {phase === 'review' && reviewPair && reviewMode === 'type' && (
          <TypeGame
            key={`eng-review-type-${lessonId}-${reviewNonce}`}
            pairs={[reviewPair]}
            locale={locale}
            maxItems={1}
            embedded
            targetSide="term"
            onAnswer={onReviewAnswer}
            onComplete={onReviewItemComplete}
            onExit={onExit}
          />
        )}
        {phase === 'review' && reviewPair && reviewMode === 'quiz' && (
          <QuizGame
            key={`eng-review-quiz-${lessonId}-${reviewNonce}`}
            pairs={reviewPool}
            focusPair={reviewPair}
            locale={locale}
            maxItems={1}
            embedded
            targetSide="term"
            shuffleSeed={`eng-review-quiz-${lessonId}-${pairKey(reviewPair)}-${reviewNonce}`}
            onAnswer={onReviewAnswer}
            onComplete={onReviewItemComplete}
            onExit={onExit}
            onNotEnoughPairs={() => {
              // Not enough distractors → fall through to listen format.
              setReviewFails((prev) => ({
                ...prev,
                [pairKey(reviewPair)]: Math.max(prev[pairKey(reviewPair)] ?? 0, 2),
              }));
              setReviewNonce((n) => n + 1);
            }}
          />
        )}
        {phase === 'review' && reviewPair && reviewMode === 'listen' && (
          <ListenPickGame
            key={`eng-review-listen-${lessonId}-${reviewNonce}`}
            pairs={reviewPool}
            focusPair={reviewPair}
            locale={locale}
            maxItems={1}
            embedded
            answerField="term"
            deckId={`eng-review-listen-${lessonId}-${pairKey(reviewPair)}-${reviewNonce}`}
            onAnswer={onReviewAnswer}
            onComplete={onReviewItemComplete}
            onExit={onExit}
          />
        )}
      </Suspense>
    </div>
  );
}
