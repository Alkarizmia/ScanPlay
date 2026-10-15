import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildDialogueChoices,
  pickDialogueForLesson,
  type DialogueGameMode,
} from '../../lib/englishDialogues';
import { registerAnswer } from '../../lib/gameFeedback';
import { t } from '../../lib/i18n';
import { speakDialogueLocal, stopDialogueSpeech, unlockSpeakAudio } from '../../lib/speech';
import type { CefrLevel, EnglishGoal, EnglishNativeLang } from '../../lib/englishCurriculum';
import type { Locale } from '../../types';
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';
import { AnswerFeedback } from './AnswerFeedback';
import { ChoiceCard, type ChoiceState } from './ChoiceCard';

type PlayRate = 0.75 | 1;

interface DialogueListenGameProps extends EmbeddedGameProps {
  locale: Locale;
  nativeLang: EnglishNativeLang;
  lessonId: string;
  level: CefrLevel;
  goal: EnglishGoal;
  mode: DialogueGameMode;
  /** Stable salt so topic/mood/fact in one lesson can differ. */
  salt?: number;
  onComplete: (score: number, total: number) => void;
  onExit: () => void;
  onAnswer?: (correct: boolean) => void;
}

export function DialogueListenGame({
  locale,
  nativeLang,
  lessonId,
  level,
  goal,
  mode,
  salt = 0,
  onComplete,
  onExit,
  onAnswer,
  embedded = false,
  onStepProgress,
}: DialogueListenGameProps) {
  const dialogue = useMemo(
    () => pickDialogueForLesson(lessonId, level, goal, salt),
    [lessonId, level, goal, salt],
  );
  const built = useMemo(() => {
    if (!dialogue) return null;
    return buildDialogueChoices(dialogue, mode, nativeLang, `${lessonId}:${mode}:${salt}`);
  }, [dialogue, mode, nativeLang, lessonId, salt]);

  const [picked, setPicked] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rate, setRate] = useState<PlayRate>(1);
  const [choicesArmed, setChoicesArmed] = useState(false);
  const [lastXp, setLastXp] = useState(0);
  const rateRef = useRef(rate);
  const playingRef = useRef(false);
  rateRef.current = rate;

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(0, 1);
  }, [embedded, onStepProgress]);

  useEffect(() => {
    if (!dialogue) onComplete(0, 1);
  }, [dialogue, onComplete]);

  /* Block ghost taps from the previous step's "Continuer" / auto-advance. */
  useEffect(() => {
    setChoicesArmed(false);
    if (!heard || picked) return;
    const arm = window.setTimeout(() => setChoicesArmed(true), 480);
    return () => window.clearTimeout(arm);
  }, [heard, picked, dialogue?.id, mode]);

  const play = useCallback(async () => {
    if (!dialogue || playingRef.current) return;
    unlockSpeakAudio();
    playingRef.current = true;
    setPlaying(true);
    setProgress(0);
    try {
      await speakDialogueLocal(dialogue.lines, 'en', {
        rate: rateRef.current === 0.75 ? 0.75 : 0.9,
        onProgress: (ratio) => setProgress(ratio),
      });
      setHeard(true);
      setProgress(1);
    } finally {
      playingRef.current = false;
      setPlaying(false);
    }
  }, [dialogue]);

  // Auto-play once when the step opens (user can replay).
  useEffect(() => {
    if (!dialogue) return;
    setPicked(null);
    setHeard(false);
    setProgress(0);
    setChoicesArmed(false);
    const tmr = window.setTimeout(() => {
      void play();
    }, 450);
    return () => {
      window.clearTimeout(tmr);
      stopDialogueSpeech();
      playingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- play once per dialogue id + mode
  }, [dialogue?.id, mode]);

  const pick = (option: string) => {
    if (!built || picked || !heard || !choicesArmed) return;
    setPicked(option);
    const ok = option === built.correct;
    setLastXp(registerAnswer(ok ? 'correct' : 'wrong'));
    onAnswer?.(ok);
    if (ok) window.setTimeout(() => onComplete(1, 1), 700);
  };

  const changeRate = (next: PlayRate) => {
    setRate(next);
    rateRef.current = next;
    if (playingRef.current) {
      stopDialogueSpeech();
      playingRef.current = false;
      setPlaying(false);
      setProgress(0);
      window.setTimeout(() => {
        void play();
      }, 80);
    }
  };

  if (!dialogue || !built) return null;

  const instructionKey =
    mode === 'topic'
      ? 'engDialogueTopicInstruction'
      : mode === 'mood'
        ? 'engDialogueMoodInstruction'
        : 'engDialogueFactInstruction';

  const missed = picked != null && picked !== built.correct;
  const showChoices = heard && !playing;

  const audioCard = (
    <AudioCard
      locale={locale}
      playing={playing}
      heard={heard}
      progress={progress}
      rate={rate}
      onPlay={() => void play()}
      onRate={changeRate}
    />
  );

  if (mode === 'fact') {
    const trueLabel = t('engDialogueTrue', locale);
    const falseLabel = t('engDialogueFalse', locale);
    const optionState = (val: 'true' | 'false'): ChoiceState => {
      if (!picked) return 'idle';
      if (val === built.correct) return 'correct';
      if (val === picked) return 'wrong';
      return 'muted';
    };
    return (
      <LessonGameShell
        embedded={embedded}
        locale={locale}
        onExit={onExit}
        progress={gameProgressPct(picked ? 1 : 0, 1)}
        className="listen-game dialogue-listen-game"
        feedback={
          missed ? (
            <AnswerFeedback
              locale={locale}
              grade="wrong"
              answer={built.correct === 'true' ? trueLabel : falseLabel}
              onContinue={() => onComplete(0, 1)}
            />
          ) : picked ? (
            <AnswerFeedback locale={locale} grade="correct" xp={lastXp} />
          ) : null
        }
      >
        <div className="game-body listen-game-body">
          <p className="game-instruction">{t(instructionKey, locale)}</p>
          {audioCard}
          <p className="dialogue-fact-prompt">{built.prompt}</p>
          {!showChoices ? (
            <p className="listen-audio-hint">{t('engDialogueListenFirst', locale)}</p>
          ) : (
            <div
              className={`choice-list listen-options${choicesArmed ? '' : ' listen-options--locked'}`}
            >
              <ChoiceCard
                index={0}
                state={optionState('true')}
                disabled={!choicesArmed || picked != null}
                onSelect={() => pick('true')}
              >
                {trueLabel}
              </ChoiceCard>
              <ChoiceCard
                index={1}
                state={optionState('false')}
                disabled={!choicesArmed || picked != null}
                onSelect={() => pick('false')}
              >
                {falseLabel}
              </ChoiceCard>
            </div>
          )}
        </div>
      </LessonGameShell>
    );
  }

  const optionState = (option: string): ChoiceState => {
    if (!picked) return 'idle';
    if (option === built.correct) return 'correct';
    if (option === picked) return 'wrong';
    return 'muted';
  };

  return (
    <LessonGameShell
      embedded={embedded}
      locale={locale}
      onExit={onExit}
      progress={gameProgressPct(picked ? 1 : 0, 1)}
      className="listen-game dialogue-listen-game"
      feedback={
        missed ? (
          <AnswerFeedback
            locale={locale}
            grade="wrong"
            answer={built.correct}
            onContinue={() => onComplete(0, 1)}
          />
        ) : picked ? (
          <AnswerFeedback locale={locale} grade="correct" xp={lastXp} />
        ) : null
      }
    >
      <div className="game-body listen-game-body">
        <p className="game-instruction">{t(instructionKey, locale)}</p>
        {audioCard}
        {!showChoices ? (
          <p className="listen-audio-hint">{t('engDialogueListenFirst', locale)}</p>
        ) : (
          <div
            className={`choice-list listen-options${choicesArmed ? '' : ' listen-options--locked'}`}
          >
            {built.options.map((option, i) => (
              <ChoiceCard
                key={option}
                index={i}
                state={optionState(option)}
                disabled={!choicesArmed || picked != null}
                onSelect={() => pick(option)}
              >
                {option}
              </ChoiceCard>
            ))}
          </div>
        )}
      </div>
    </LessonGameShell>
  );
}

function AudioCard({
  locale,
  playing,
  heard,
  progress,
  rate,
  onPlay,
  onRate,
}: {
  locale: Locale;
  playing: boolean;
  heard: boolean;
  progress: number;
  rate: PlayRate;
  onPlay: () => void;
  onRate: (rate: PlayRate) => void;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div className="listen-audio-card">
      <span className="listen-audio-icon" aria-hidden="true">
        🎧
      </span>
      <div
        className="listen-audio-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={t('engDialogueProgress', locale)}
      >
        <span className="listen-audio-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="listen-audio-controls">
        <button
          type="button"
          className="btn-primary listen-hear-btn"
          onClick={onPlay}
          disabled={playing}
          aria-busy={playing}
        >
          {playing
            ? t('engDialoguePlaying', locale)
            : heard
              ? t('dictationReplay', locale)
              : t('engDialoguePlay', locale)}
        </button>
        <div className="listen-audio-rates" role="group" aria-label={t('engDialogueSpeed', locale)}>
          <button
            type="button"
            className={`listen-audio-rate${rate === 0.75 ? ' listen-audio-rate--on' : ''}`}
            onClick={() => onRate(0.75)}
            aria-pressed={rate === 0.75}
          >
            x0.75
          </button>
          <button
            type="button"
            className={`listen-audio-rate${rate === 1 ? ' listen-audio-rate--on' : ''}`}
            onClick={() => onRate(1)}
            aria-pressed={rate === 1}
          >
            x1
          </button>
        </div>
      </div>
    </div>
  );
}
