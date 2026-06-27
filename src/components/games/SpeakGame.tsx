import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { HearButton } from '../HearButton';
import { getExamTimerSeconds } from '../../lib/examTimer';
import { playGameCorrectSound, playSound } from '../../lib/sounds';
import { addCorrectAnswer } from '../../lib/gamification';
import { vibrateError, vibrateSuccess } from '../../lib/haptics';
import { t } from '../../lib/i18n';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import { buildSpeakChallenge, parsePhraseDisplay } from '../../lib/speakPhrases';
import {
  acquireMicStream,
  getActiveMicStream,
  gradeSpokenFromCandidates,
  isSpeechRecognitionSupported,
  listenForSpeech,
  releaseMicStream,
} from '../../lib/speechRecognition';
import { canUseServerTranscribe, recordSpeechWithVAD, transcribeViaServer } from '../../lib/speechServer';
import { coercePlayablePairs, isMathLikeText, type AnswerGrade } from '../../lib/vocabulary';
import type { GameCompleteMeta, LangCode, Locale, WordPair } from '../../types';
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';

type VoicePhase = 'idle' | 'listening' | 'speaking' | 'analyzing';

interface SpeakGameProps extends EmbeddedGameProps {
  pairs: WordPair[];
  locale: Locale;
  examMode?: boolean;
  deckId?: string | null;
  stepIndex?: number | null;
  onComplete: (score: number, total: number, meta?: GameCompleteMeta) => void;
  onExit: () => void;
}

export function SpeakGame({
  pairs,
  locale,
  examMode,
  deckId,
  stepIndex,
  onComplete,
  onExit,
  embedded = false,
  onStepProgress,
}: SpeakGameProps) {
  const pool = useMemo(
    () =>
      coercePlayablePairs(pairs).filter(
        (p) => !isMathLikeText(p.term) && !isMathLikeText(p.definition) && p.term.length >= 2,
      ),
    [pairs],
  );
  const total = Math.min(pool.length, examMode ? 6 : 5);
  const deck = pool.slice(0, total);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, total);
  }, [embedded, onStepProgress, index, total]);

  const [score, setScore] = useState(0);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const [revealed, setRevealed] = useState(false);
  const [grade, setGrade] = useState<AnswerGrade>('wrong');
  const [heard, setHeard] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [selfCheck, setSelfCheck] = useState(false);
  const [skipMenu, setSkipMenu] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const busyRef = useRef(false);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  const useGroq = canUseServerTranscribe();
  const supported = useGroq || isSpeechRecognitionSupported();

  const current = deck[index];
  const challenge = current ? buildSpeakChallenge(current) : null;
  const timerSeconds = examMode ? getExamTimerSeconds('speak', total) : 0;
  const [timeLeft, setTimeLeft] = useState(timerSeconds);

  useEffect(() => {
    if (!examMode || timerSeconds <= 0) return;
    setTimeLeft(timerSeconds);
    const timer = setInterval(() => {
      setTimeLeft((tLeft) => {
        if (tLeft <= 1) {
          onComplete(scoreRef.current, total);
          return 0;
        }
        if (tLeft <= 11) playSound('examTick');
        return tLeft - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [examMode, timerSeconds, total, onComplete]);

  useEffect(() => {
    return () => stopRef.current?.();
  }, []);

  useEffect(() => {
    if (!supported) return;
    void acquireMicStream();
    return () => releaseMicStream();
  }, [supported]);

  useEffect(() => {
    setRevealed(false);
    setGrade('wrong');
    setHeard('');
    setMicError(null);
    setShowFallback(false);
    setSelfCheck(false);
    setVoicePhase('idle');
    setMicLevel(0);
    setSkipMenu(false);
    busyRef.current = false;
    stopRef.current?.();
    stopRef.current = null;
  }, [index]);

  const finish = useCallback(
    (finalScore: number, meta?: GameCompleteMeta) => onComplete(finalScore, total, meta),
    [onComplete, total],
  );

  const applyGrade = useCallback(
    (g: AnswerGrade, transcript: string) => {
      setGrade(g);
      setHeard(transcript);
      setRevealed(true);
      setVoicePhase('idle');
      busyRef.current = false;
      if (g === 'correct') {
        const newScore = score + 1;
        setScore(newScore);
        scoreRef.current = newScore;
        addCorrectAnswer();
        if (current) markCorrected(current);
        vibrateSuccess();
        playGameCorrectSound(stepIndex != null);
      } else if (g === 'near') {
        const newScore = score + 0.5;
        setScore(newScore);
        scoreRef.current = newScore;
        vibrateSuccess();
        playSound('nearMiss');
      } else {
        if (current) recordMistake(current, 'speak', deckId ?? undefined, stepIndex ?? undefined);
        vibrateError();
        playSound('wrong');
      }
    },
    [score, current, deckId, stepIndex],
  );

  const gradeTranscript = useCallback(
    (text: string, target: string, phraseSpeech: string): AnswerGrade =>
      gradeSpokenFromCandidates([text], target, { phraseSpeech }),
    [],
  );

  const startWebListeningRef = useRef<() => void>(() => {});

  const startWebListening = useCallback(() => {
    if (!challenge) return;

    stopRef.current = listenForSpeech(
      challenge.lang,
      (transcript, alternatives) => {
        stopRef.current = null;
        busyRef.current = false;
        setVoicePhase('idle');
        const alts = alternatives.length > 0 ? alternatives : [transcript];
        const best = alts.reduce<AnswerGrade>(
          (acc, alt) => {
            const g = gradeSpokenFromCandidates([alt], challenge.target, {
              phraseSpeech: challenge.phraseSpeech,
            });
            if (g === 'correct') return 'correct';
            if (g === 'near' && acc !== 'correct') return 'near';
            return acc;
          },
          'wrong',
        );
        applyGrade(best, transcript);
      },
      (reason) => {
        stopRef.current = null;
        busyRef.current = false;
        setVoicePhase('idle');
        if (reason === 'denied') {
          setMicError(t('speakMicDenied', locale));
          setShowFallback(true);
        } else {
          setMicError(t('speakNoSpeech', locale));
          setShowFallback(true);
        }
      },
      {
        expectLongPhrase: challenge.phraseSpeech.length > 24,
        onInterim: () => setVoicePhase('speaking'),
        shouldStopEarly: (alts) => {
          const g = gradeSpokenFromCandidates(alts, challenge.target, {
            phraseSpeech: challenge.phraseSpeech,
          });
          return g === 'correct';
        },
      },
    );
  }, [applyGrade, challenge, locale]);

  startWebListeningRef.current = startWebListening;

  const analyzeBlob = useCallback(
    async (blob: Blob | null, target: string, phraseSpeech: string, lang: LangCode) => {
      if (!blob || blob.size < 400) {
        setVoicePhase('idle');
        busyRef.current = false;
        setMicError(t('speakNoSpeech', locale));
        setShowFallback(true);
        return;
      }

      setVoicePhase('analyzing');
      const text = await transcribeViaServer(blob, lang);
      busyRef.current = false;

      if (!text) {
        if (isSpeechRecognitionSupported()) {
          setMicError(null);
          busyRef.current = false;
          setVoicePhase('listening');
          startWebListeningRef.current();
          return;
        }
        setMicError(t('speakNetworkError', locale));
        setShowFallback(true);
        return;
      }

      applyGrade(gradeTranscript(text, target, phraseSpeech), text);
    },
    [applyGrade, gradeTranscript, locale],
  );

  const startGroqListening = useCallback(async () => {
    if (!challenge) return;

    const stream = (await acquireMicStream()) ?? getActiveMicStream();

    const { promise, stop } = recordSpeechWithVAD({
      stream,
      silenceMs: 850,
      maxMs: 6000,
      onLevel: (level) => setMicLevel(level),
      onSpeechStart: () => setVoicePhase('speaking'),
      onSpeechEnd: () => setVoicePhase('analyzing'),
    });
    stopRef.current = stop;

    const blob = await promise;
    stopRef.current = null;
    await analyzeBlob(blob, challenge.target, challenge.phraseSpeech, challenge.lang);
  }, [analyzeBlob, challenge]);

  const startListening = useCallback(() => {
    if (!current || !challenge || revealed || busyRef.current) return;

    busyRef.current = true;
    setMicError(null);
    setShowFallback(false);
    setSkipMenu(false);
    setVoicePhase('listening');
    setMicLevel(0);
    playSound('tap');
    stopRef.current?.();

    if (useGroq) {
      void startGroqListening();
      return;
    }
    startWebListening();
  }, [challenge, current, revealed, startGroqListening, startWebListening, useGroq]);

  const handleMicPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    void acquireMicStream();
    startListening();
  };

  const confirmSelfCheck = () => {
    if (!challenge || revealed) return;
    setMicError(null);
    setShowFallback(false);
    setSelfCheck(true);
    setHeard('');
    setGrade('near');
    setRevealed(true);
    setVoicePhase('idle');
    busyRef.current = false;
    const newScore = score + 0.5;
    setScore(newScore);
    scoreRef.current = newScore;
    playSound('tap');
  };

  const skipThisQuestion = () => {
    setSkipMenu(false);
    stopRef.current?.();
    stopRef.current = null;
    busyRef.current = false;
    setVoicePhase('idle');
    if (index >= total - 1) {
      finish(scoreRef.current);
      return;
    }
    setIndex((i) => i + 1);
  };

  const skipAllOral = () => {
    setSkipMenu(false);
    stopRef.current?.();
    stopRef.current = null;
    busyRef.current = false;
    finish(scoreRef.current, { technical: true });
  };

  const next = () => {
    if (index >= total - 1) {
      finish(scoreRef.current);
      return;
    }
    setIndex((i) => i + 1);
  };

  if (deck.length === 0) {
    return (
      <LessonGameShell embedded={embedded} locale={locale} onExit={onExit} progress={0} className="speak-game">
        <div className="game-body speak-game-body">
          <p className="speak-game-empty">{t('speakUnsupported', locale)}</p>
          <button type="button" className="btn-secondary btn-lg" onClick={() => finish(0, { technical: true })}>
            {t('speakSkipAll', locale)}
          </button>
        </div>
      </LessonGameShell>
    );
  }

  if (!current || !challenge) return null;

  const micBusy = voicePhase !== 'idle';
  const phaseLabel =
    voicePhase === 'analyzing'
      ? t('speakProcessing', locale)
      : voicePhase === 'speaking'
        ? t('speakListening', locale)
        : voicePhase === 'listening'
          ? t('speakSpeakNow', locale)
          : t('speakGameMic', locale);

  const liveHint =
    voicePhase === 'analyzing'
      ? t('speakAnalyzingHint', locale)
      : voicePhase === 'speaking'
        ? t('speakPauseHint', locale)
        : voicePhase === 'listening'
          ? t('speakSpeakNow', locale)
          : '';

  return (
    <LessonGameShell
      embedded={embedded}
      locale={locale}
      onExit={onExit}
      progress={gameProgressPct(index + 1, total)}
      examMode={examMode}
      timeLeft={timeLeft}
      className="speak-game"
    >
      <div className="game-body speak-game-scroll">
        <p className="speak-game-intro">{t('speakGameIntro', locale)}</p>
        <p className="speak-game-context">
          {t('speakGameContext', locale).replace('{definition}', challenge.context)}
        </p>
        {challenge.altFormsNote && (
          <p className="speak-game-alt-forms">
            {t('speakAltForms', locale).replace('{forms}', challenge.altFormsNote)}
          </p>
        )}
        <div className="speak-game-phrase-card">
          <p className="speak-game-phrase">
            {parsePhraseDisplay(challenge.phraseDisplay).map((part, i) =>
              part.kind === 'term' ? (
                <mark key={i} className="speak-game-target">
                  {part.value}
                </mark>
              ) : (
                <span key={i}>{part.value}</span>
              ),
            )}
          </p>
          <p className="speak-game-listen-first">{t('speakListenFirst', locale)}</p>
          <HearButton text={challenge.phraseSpeech} lang={challenge.lang} locale={locale} />
        </div>

        {revealed && (
          <p className={`type-game-feedback ${grade === 'wrong' && !selfCheck ? 'wrong' : 'correct'}`}>
            {selfCheck && (
              <>
                {t('speakSelfCheckDone', locale)}
                <span className="type-game-near-hint"> · {t('typeNearHint', locale)}</span>
              </>
            )}
            {!selfCheck && grade === 'correct' && t('speakCorrect', locale)}
            {!selfCheck && grade === 'near' && (
              <>
                {t('typeNear', locale)}{' '}
                <strong>{challenge.target}</strong>
                <span className="type-game-near-hint"> · {t('typeNearHint', locale)}</span>
              </>
            )}
            {!selfCheck && grade === 'wrong' && (
              <>
                {t('speakWrong', locale)} → <strong>{challenge.target}</strong>
              </>
            )}
            {!selfCheck && heard && (
              <span className="type-game-you-wrote">
                {' '}
                ({t('speakHeard', locale)}: <em>{heard}</em>)
              </span>
            )}
          </p>
        )}

        {!revealed && (
          <div className="speak-skip-block">
            <button type="button" className="btn-ghost speak-skip-trigger" onClick={() => setSkipMenu(true)}>
              {t('speakSkip', locale)}
            </button>
          </div>
        )}
      </div>

      {!revealed && (
        <div className="speak-game-voice-dock">
          {!supported ? (
            <div className="speak-game-fallback">
              <p className="speak-game-error">{t('speakUnsupported', locale)}</p>
              <p className="speak-game-fallback-hint">{t('speakFallbackHint', locale)}</p>
              <button type="button" className="btn-secondary btn-lg" onClick={confirmSelfCheck}>
                {t('speakSelfCheck', locale)}
              </button>
            </div>
          ) : (
            <>
              <div
                className={`speak-game-mic-wrap${micBusy ? ' speak-game-mic-wrap--active' : ''}${voicePhase === 'analyzing' ? ' speak-game-mic-wrap--analyzing' : ''}`}
              >
                {voicePhase === 'analyzing' && <div className="speak-game-spinner" aria-hidden />}
                <div className="speak-game-mic-levels" aria-hidden>
                  {[0.25, 0.5, 0.75, 1].map((threshold) => (
                    <span
                      key={threshold}
                      className={`speak-game-mic-bar${micLevel >= threshold - 0.15 ? ' speak-game-mic-bar--on' : ''}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className={`speak-game-mic${micBusy ? ' speak-game-mic--active' : ''}`}
                  onPointerDown={handleMicPointerDown}
                  disabled={micBusy}
                >
                  🎤 {phaseLabel}
                </button>
              </div>
              {micBusy && liveHint && (
                <p
                  className={`speak-game-live${voicePhase === 'analyzing' ? ' speak-game-live--analyzing' : voicePhase === 'speaking' ? '' : ' speak-game-live--waiting'}`}
                >
                  {liveHint}
                </p>
              )}
              {micError && <p className="speak-game-error">{micError}</p>}
              {showFallback && (
                <div className="speak-game-fallback speak-game-fallback--compact">
                  <p className="speak-game-fallback-hint">{t('speakFallbackHint', locale)}</p>
                  <button type="button" className="btn-secondary btn-lg" onClick={confirmSelfCheck}>
                    {t('speakSelfCheck', locale)}
                  </button>
                </div>
              )}
              {!micBusy && !micError && (
                <p className="speak-game-hint">{t('speakMicHintGroq', locale)}</p>
              )}
            </>
          )}
        </div>
      )}

      {skipMenu && !revealed && (
        <>
          <button
            type="button"
            className="speak-skip-backdrop"
            aria-label={t('cancel', locale)}
            onClick={() => setSkipMenu(false)}
          />
          <div className="speak-skip-sheet" role="dialog" aria-modal="true" aria-labelledby="speak-skip-title">
            <p id="speak-skip-title" className="speak-skip-prompt">
              {t('speakSkipPrompt', locale)}
            </p>
            <button type="button" className="btn-secondary btn-lg" onClick={skipThisQuestion}>
              {t('speakSkipOne', locale)}
            </button>
            <button type="button" className="btn-secondary btn-lg" onClick={skipAllOral}>
              {t('speakSkipAll', locale)}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setSkipMenu(false)}>
              {t('cancel', locale)}
            </button>
          </div>
        </>
      )}

      <div className="game-actions">
        {revealed && (
          <button type="button" className="btn-primary btn-lg" onClick={next}>
            {index >= total - 1 ? t('typeFinish', locale) : t('typeNext', locale)}
          </button>
        )}
        {!supported && !revealed && (
          <button type="button" className="btn-secondary btn-lg" onClick={skipAllOral}>
            {t('speakSkipAll', locale)}
          </button>
        )}
      </div>
    </LessonGameShell>
  );
}
