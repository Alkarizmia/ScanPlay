import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import {
  completeEnglishLesson,
  getEnglishLessonPairs,
  getUniverseEnglish,
  recordUniverseWeakSuccess,
  recordUniverseWeakWord,
  setEnglishCurrentLesson,
} from '../lib/universeEnglish';
import { ENGLISH_LESSONS } from '../lib/englishCurriculum';
import { hasEnoughImagePickPairs } from '../lib/imagePickRounds';
import { buildListenPickRounds } from '../lib/listenPickRounds';
import { buildLocalTranslateRounds } from '../lib/translateRounds';
import { canPlayUniverse, loseUniverseHeart } from '../lib/universeHearts';
import { playSound } from '../lib/sounds';
import { t } from '../lib/i18n';
import type { GameCompleteMeta, Locale, WordPair } from '../types';
import { gameProgressPct, GameHeader } from './games/GameHeader';

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

type StepKind = 'listen' | 'speak' | 'quiz' | 'type' | 'image' | 'translate';

interface MixStep {
  kind: StepKind;
  focus: WordPair;
}

interface EnglishLessonPlayProps {
  locale: Locale;
  lessonId: string;
  onExit: () => void;
  onHeartLost: () => void;
  onComplete: () => void;
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

function canPlayKind(kind: StepKind, focus: WordPair, pool: WordPair[]): boolean {
  if (kind === 'image') return hasEnoughImagePickPairs([focus]);
  // Listen-pick needs ≥4 short bilingual candidates in the lesson pool, else rounds = [].
  if (kind === 'listen') return buildListenPickRounds(pool, { maxRounds: 1 }).length >= 1;
  if (kind === 'translate') return buildLocalTranslateRounds(pool, 1).length >= 1;
  return true;
}

function fallbackKind(prev: StepKind | undefined, focus: WordPair, pool: WordPair[]): StepKind {
  const candidates: StepKind[] = ['quiz', 'type', 'translate', 'speak', 'listen', 'image'];
  for (const kind of candidates) {
    if (kind === prev) continue;
    if (canPlayKind(kind, focus, pool)) return kind;
  }
  return prev === 'quiz' ? 'type' : 'quiz';
}

/** Duolingo-style: alternate exercise types, never a block of the same kind. */
function buildMixedSteps(pairs: WordPair[], lessonId: string): MixStep[] {
  const rotation: StepKind[] = ['quiz', 'listen', 'translate', 'speak', 'image', 'type', 'quiz', 'listen'];
  const steps: MixStep[] = [];
  let rot = lessonId.length % rotation.length;

  for (const focus of pairs) {
    let attempts = 0;
    let kind = rotation[rot % rotation.length]!;
    while (attempts < rotation.length && !canPlayKind(kind, focus, pairs)) {
      rot += 1;
      kind = rotation[rot % rotation.length]!;
      attempts += 1;
    }
    if (!canPlayKind(kind, focus, pairs)) {
      kind = fallbackKind(undefined, focus, pairs);
    }
    const prev = steps[steps.length - 1]?.kind;
    if (prev === kind) {
      rot += 1;
      kind = rotation[rot % rotation.length]!;
      if (!canPlayKind(kind, focus, pairs) || kind === prev) {
        kind = fallbackKind(prev, focus, pairs);
      }
    }
    steps.push({ kind, focus });
    rot += 1;
  }

  const extraKinds: StepKind[] = ['type', 'quiz', 'listen'];
  for (let i = 0; i < Math.min(3, pairs.length); i += 1) {
    const focus = pairs[(i * 3) % pairs.length]!;
    let kind = extraKinds[i % extraKinds.length]!;
    if (!canPlayKind(kind, focus, pairs) || steps[steps.length - 1]?.kind === kind) {
      kind = fallbackKind(steps[steps.length - 1]?.kind, focus, pairs);
    }
    steps.push({ kind, focus });
  }

  return steps;
}

export function EnglishLessonPlay({
  locale,
  lessonId,
  onExit,
  onHeartLost,
  onComplete,
}: EnglishLessonPlayProps) {
  const profile = getUniverseEnglish();
  const lesson = ENGLISH_LESSONS.find((l) => l.id === lessonId);
  const pairs = useMemo(
    () => getEnglishLessonPairs(lessonId, profile.nativeLang),
    [lessonId, profile.nativeLang],
  );
  const steps = useMemo(() => buildMixedSteps(pairs, lessonId), [pairs, lessonId]);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<'play' | 'review' | 'done'>('play');
  const [reviewPairs, setReviewPairs] = useState<WordPair[]>([]);
  const weakRef = useRef<WordPair[]>([]);
  const titleLang = locale === 'en' ? 'en' : locale === 'nl' || locale === 'es' || locale === 'ar' ? locale : 'fr';

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
    completeEnglishLesson(lessonId);
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
    setStepIndex((i) => i + 1);
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
      <div className="english-play">
        <p className="pix-universe-locked-banner">{t('universeHeartsComeBack', locale)}</p>
        <button type="button" className="btn-secondary" onClick={onExit}>
          {t('back', locale)}
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="english-play english-play--done">
        <p className="english-play-xp">+25 XP</p>
        <h3 className="english-onboard-title">{t('engLessonComplete', locale)}</h3>
        <p className="english-onboard-sub">{lesson.title[titleLang]}</p>
        <button
          type="button"
          className="btn-primary english-onboard-cta"
          onClick={() => {
            playSound('tap');
            onComplete();
          }}
        >
          {t('engNext', locale)}
        </button>
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
        {phase === 'review' && reviewPairs.length > 0 && (
          <TypeGame
            pairs={reviewPairs}
            locale={locale}
            maxItems={reviewPairs.length}
            embedded
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
