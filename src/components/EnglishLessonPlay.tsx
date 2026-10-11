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
  const candidates: StepKind[] = ['quiz', 'type', 'translate', 'speak', 'listen', 'image'];
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
  const rotation: StepKind[] = ['quiz', 'listen', 'translate', 'speak', 'image', 'type', 'quiz', 'listen'];
  const steps: MixStep[] = [];
  let rot = lessonId.length % rotation.length;

  for (const focus of pairs) {
    let attempts = 0;
    let kind = rotation[rot % rotation.length]!;
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
    steps.push({ kind, focus });
    rot += 1;
  }

  const extraKinds: StepKind[] = ['type', 'quiz', 'listen'];
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
  const [reviewPairs, setReviewPairs] = useState<WordPair[]>([]);
  const [nextLessonId, setNextLessonId] = useState<string | null>(null);
  const [nextLessonTitle, setNextLessonTitle] = useState('');
  const weakRef = useRef<WordPair[]>([]);
  const titleLang = locale === 'en' ? 'en' : locale === 'nl' || locale === 'es' || locale === 'ar' ? locale : 'fr';

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

  const markWrong = (pair: WordPair) => {
    weakRef.current = uniqPairs([...weakRef.current, pair]);
    recordUniverseWeakWord(pair.term);
    loseHeart();
  };

  const markRight = (pair: WordPair) => {
    recordUniverseWeakSuccess(pair.term);
  };

  const finishLesson = () => {
    setEnglishCurrentLesson(lessonId);
    const after = completeEnglishLesson(lessonId);
    const nextId = after.currentLessonId !== lessonId ? after.currentLessonId : null;
    const nextLesson = nextId ? ENGLISH_LESSONS.find((l) => l.id === nextId) : undefined;
    setNextLessonId(nextId);
    setNextLessonTitle(nextLesson?.title[titleLang] ?? '');
    playSound('perfect');
    setPhase('done');
  };

  const advanceStep = () => {
    if (stepIndex + 1 >= steps.length) {
      const weak = uniqPairs(weakRef.current);
      if (weak.length === 0) {
        finishLesson();
        return;
      }
      setReviewPairs(weak);
      setPhase('review');
      return;
    }
    playSound('correct');
    const next = stepIndex + 1;
    setStepIndex(next);
    setEnglishLessonStep(lessonId, next);
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

  if (!canPlayUniverse() && phase !== 'done') {
    return (
      <div className="english-play english-play--game">
        <UniverseOutOfHearts locale={locale} onBack={onExit} />
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="english-play english-play--game">
        <div className="english-lesson-done" role="status">
          <div className="english-lesson-done-bg" aria-hidden="true">
            <span className="english-lesson-done-orb english-lesson-done-orb--a" />
            <span className="english-lesson-done-orb english-lesson-done-orb--b" />
            <span className="english-lesson-done-burst" />
          </div>
          <div className="english-lesson-done-panel">
            <div className="english-lesson-done-mascot" aria-hidden="true">
              <ScanPlayMascot expression="celebrating" size={132} idle celebrate preferAsset />
            </div>
            <p className="english-lesson-done-xp">+25 XP</p>
            <h3 className="english-lesson-done-title">{t('engLessonComplete', locale)}</h3>
            <p className="english-lesson-done-sub">{lesson.title[titleLang]}</p>
            {nextLessonId ? (
              <>
                {nextLessonTitle ? (
                  <p className="english-lesson-done-next-label">{nextLessonTitle}</p>
                ) : null}
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
              </>
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
  const progress = gameProgressPct(phase === 'review' ? steps.length : stepIndex, totalUnits);
  const stepPool = step ? uniqPairs([step.focus, ...pairs]) : pairs;

  return (
    <div className="english-play english-play--game">
      {/* One ScanPlay ✕ + one chromatic bar; games are embedded (no second chrome). */}
      <GameHeader locale={locale} onExit={onExit} progress={progress} />
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
            pairs={stepPool}
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
        {phase === 'review' && reviewPairs.length > 0 && (
          <TypeGame
            pairs={reviewPairs}
            locale={locale}
            maxItems={reviewPairs.length}
            embedded
            targetSide="term"
            onAnswer={(pair, correct) => {
              if (!correct) {
                markWrong(pair);
              } else {
                markRight(pair);
                weakRef.current = weakRef.current.filter(
                  (p) => p.term.toLowerCase() !== pair.term.toLowerCase(),
                );
              }
            }}
            onComplete={() => {
              if (weakRef.current.length === 0) {
                finishLesson();
                return;
              }
              setReviewPairs(uniqPairs(weakRef.current));
              playSound('wrong');
            }}
            onExit={onExit}
          />
        )}
      </Suspense>
    </div>
  );
}
