import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildDialogueChoices,
  pickDialogueForLesson,
  type DialogueGameMode,
} from '../../lib/englishDialogues';
import { registerAnswer } from '../../lib/gameFeedback';
import { t } from '../../lib/i18n';
import { speakDialogueLocal, unlockSpeakAudio } from '../../lib/speech';
import type { CefrLevel, EnglishGoal, EnglishNativeLang } from '../../lib/englishCurriculum';
import type { Locale } from '../../types';
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';
import { AnswerFeedback } from './AnswerFeedback';
import { ChoiceCard, type ChoiceState } from './ChoiceCard';

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
  const [lastXp, setLastXp] = useState(0);

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(0, 1);
  }, [embedded, onStepProgress]);

  useEffect(() => {
    if (!dialogue) onComplete(0, 1);
  }, [dialogue, onComplete]);

  const play = useCallback(async () => {
    if (!dialogue || playing) return;
    unlockSpeakAudio();
    setPlaying(true);
    try {
      await speakDialogueLocal(dialogue.lines, 'en');
      setHeard(true);
    } finally {
      setPlaying(false);
    }
  }, [dialogue, playing]);

  // Auto-play once when the step opens (user can replay).
  useEffect(() => {
    if (!dialogue) return;
    const tmr = window.setTimeout(() => {
      void play();
    }, 400);
    return () => window.clearTimeout(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- play once per dialogue id
  }, [dialogue?.id]);

  const pick = (option: string) => {
    if (!built || picked || !heard) return;
    setPicked(option);
    const ok = option === built.correct;
    setLastXp(registerAnswer(ok ? 'correct' : 'wrong'));
    onAnswer?.(ok);
    if (ok) window.setTimeout(() => onComplete(1, 1), 700);
  };

  if (!dialogue || !built) return null;

  const instructionKey =
    mode === 'topic'
      ? 'engDialogueTopicInstruction'
      : mode === 'mood'
        ? 'engDialogueMoodInstruction'
        : 'engDialogueFactInstruction';

  const missed = picked != null && picked !== built.correct;

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
          <AudioCard locale={locale} playing={playing} heard={heard} onPlay={() => void play()} />
          <p className="dialogue-fact-prompt">{built.prompt}</p>
          <div className="choice-list listen-options">
            <ChoiceCard
              index={0}
              state={optionState('true')}
              disabled={!heard || picked != null}
              onSelect={() => pick('true')}
            >
              {trueLabel}
            </ChoiceCard>
            <ChoiceCard
              index={1}
              state={optionState('false')}
              disabled={!heard || picked != null}
              onSelect={() => pick('false')}
            >
              {falseLabel}
            </ChoiceCard>
          </div>
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
        <AudioCard locale={locale} playing={playing} heard={heard} onPlay={() => void play()} />
        {!heard ? (
          <p className="listen-audio-hint">{t('engDialogueListenFirst', locale)}</p>
        ) : (
          <div className="choice-list listen-options">
            {built.options.map((option, i) => (
              <ChoiceCard
                key={option}
                index={i}
                state={optionState(option)}
                disabled={picked != null}
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
  onPlay,
}: {
  locale: Locale;
  playing: boolean;
  heard: boolean;
  onPlay: () => void;
}) {
  return (
    <div className="listen-audio-card">
      <span className="listen-audio-icon" aria-hidden="true">
        🎧
      </span>
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
      <p className="listen-audio-hint">{t('engDialogueHint', locale)}</p>
    </div>
  );
}
