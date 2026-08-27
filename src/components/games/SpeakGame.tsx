import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  wordIsHeardInTranscript,
} from '../../lib/speechRecognition';
import {
  canUseServerTranscribe,
  probeServerTranscribe,
  recordSpeechWithVAD,
  transcribeViaServer,
  type ServerTranscribeError,
} from '../../lib/speechServer';
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
  maxItems,
}: SpeakGameProps) {
  const pool = useMemo(
    () =>
      coercePlayablePairs(pairs).filter(
        (p) => !isMathLikeText(p.term) && !isMathLikeText(p.definition) && p.term.length >= 2,
      ),
    [pairs],
  );
  const total = Math.min(pool.length, examMode ? 6 : (maxItems ?? 5));
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
  const [liveHeard, setLiveHeard] = useState('');
  const [heardVoice, setHeardVoice] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [groqProbe, setGroqProbe] = useState<'unknown' | 'ok' | 'missing_key' | 'down'>('unknown');
  const [showFallback, setShowFallback] = useState(false);
  const [selfCheck, setSelfCheck] = useState(false);
  const [skipMenu, setSkipMenu] = useState(false);
  const stopRef = useRef<((commit?: boolean) => void) | null>(null);
  const busyRef = useRef(false);
  const ignoreResultRef = useRef(false);
  const gradedEarlyRef = useRef(false);
  const probeBusyRef = useRef(false);
  const heardVoiceRef = useRef(false);
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
    setLiveHeard('');
    setMicError(null);
    setShowFallback(false);
    setSelfCheck(false);
    setVoicePhase('idle');
    setMicLevel(0);
    setHeardVoice(false);
    setSkipMenu(false);
    busyRef.current = false;
    ignoreResultRef.current = true;
    gradedEarlyRef.current = false;
    stopRef.current?.(false);
    stopRef.current = null;
  }, [index]);

  useEffect(() => {
    if (!useGroq) return;
    void probeServerTranscribe().then(setGroqProbe);
  }, [useGroq]);

  const transcribeErrorMessage = useCallback(
    (error: ServerTranscribeError) => {
      if (error === 'auth') return t('speakNeedAuth', locale);
      if (error === 'not_configured') return t('speakServerMissing', locale);
      return t('speakNetworkError', locale);
    },
    [locale],
  );

  const finish = useCallback(
    (finalScore: number, meta?: GameCompleteMeta) => onComplete(finalScore, total, meta),
    [onComplete, total],
  );

  const applyGrade = useCallback(
    (g: AnswerGrade, transcript: string) => {
      if (ignoreResultRef.current) return;
      setGrade(g);
      setHeard(transcript);
      setLiveHeard(transcript);
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
          setMicError(t('speakTooQuiet', locale));
        }
      },
      {
        expectLongPhrase: challenge.phraseSpeech.length > 24,
        untilStop: true,
        onQuiet: () => setMicError(t('speakTooQuiet', locale)),
        onSessionEnd: () => {
          if (ignoreResultRef.current || gradedEarlyRef.current) return;
          stopRef.current = null;
          busyRef.current = false;
          setVoicePhase('idle');
          setMicError(t('speakRetryHint', locale));
        },
        onInterim: (transcript) => {
          setVoicePhase('speaking');
          setHeardVoice(true);
          setLiveHeard(transcript);
          setMicError(null);
        },
        shouldStopEarly: (alts) => {
          const g = gradeSpokenFromCandidates(alts, challenge.target, {
            phraseSpeech: challenge.phraseSpeech,
          });
          return g === 'correct';
        },
      },
    );
  }, [applyGrade, challenge, locale]);

  const analyzeBlob = useCallback(
    async (blob: Blob | null, target: string, phraseSpeech: string, lang: LangCode) => {
      if (ignoreResultRef.current || gradedEarlyRef.current) return;
      if (!blob || blob.size < 400) {
        setVoicePhase('idle');
        busyRef.current = false;
        setMicError(t('speakTooQuiet', locale));
        return;
      }

      setVoicePhase('analyzing');
      const { text, error } = await transcribeViaServer(blob, lang);
      if (ignoreResultRef.current || gradedEarlyRef.current) return;
      busyRef.current = false;

      if (!text) {
        setVoicePhase('idle');
        setMicError(error ? transcribeErrorMessage(error) : t('speakTooQuiet', locale));
        return;
      }

      setLiveHeard(text);
      applyGrade(gradeTranscript(text, target, phraseSpeech), text);
    },
    [applyGrade, gradeTranscript, locale, transcribeErrorMessage],
  );

  const startGroqListening = useCallback(async () => {
    if (!challenge) return;
    gradedEarlyRef.current = false;
    heardVoiceRef.current = false;

    const stream = (await acquireMicStream()) ?? getActiveMicStream();
    const target = challenge.target;
    const phraseSpeech = challenge.phraseSpeech;
    const lang = challenge.lang;

    const { promise, stop } = recordSpeechWithVAD({
      stream,
      untilStop: true,
      chunkMs: 1600,
      onLevel: (level) => setMicLevel(level),
      onSpeechStart: () => {
        heardVoiceRef.current = true;
        setVoicePhase('speaking');
        setHeardVoice(true);
        setMicError(null);
      },
      onSpeechEnd: () => {
        if (!gradedEarlyRef.current && !ignoreResultRef.current) setVoicePhase('analyzing');
      },
      onChunk: (blob) => {
        if (probeBusyRef.current || gradedEarlyRef.current || ignoreResultRef.current) return;
        probeBusyRef.current = true;
        void transcribeViaServer(blob, lang).then(({ text, error }) => {
          probeBusyRef.current = false;
          if (gradedEarlyRef.current || ignoreResultRef.current) return;
          if (text) {
            heardVoiceRef.current = true;
            setHeardVoice(true);
            setLiveHeard(text);
            setMicError(null);
            const g = gradeTranscript(text, target, phraseSpeech);
            if (g === 'correct') {
              gradedEarlyRef.current = true;
              stopRef.current?.(false);
              stopRef.current = null;
              applyGrade(g, text);
            }
          } else if (error === 'auth' || error === 'not_configured') {
            setMicError(transcribeErrorMessage(error));
          } else if (!heardVoiceRef.current) {
            setMicError(t('speakTooQuiet', locale));
          }
        });
      },
    });
    stopRef.current = () => stop();

    const blob = await promise;
    stopRef.current = null;
    if (gradedEarlyRef.current || ignoreResultRef.current) return;
    await analyzeBlob(blob, target, phraseSpeech, lang);
  }, [analyzeBlob, applyGrade, challenge, gradeTranscript, locale, transcribeErrorMessage]);

  const recording = voicePhase === 'listening' || voicePhase === 'speaking';

  const startListening = useCallback(() => {
    if (!current || !challenge || revealed) return;
    if (voicePhase === 'analyzing') return;

    if (recording) {
      stopRef.current?.(true);
      return;
    }

    ignoreResultRef.current = false;
    gradedEarlyRef.current = false;
    heardVoiceRef.current = false;
    busyRef.current = true;
    setMicError(null);
    setShowFallback(false);
    setSkipMenu(false);
    setHeardVoice(false);
    setLiveHeard('');
    setVoicePhase('listening');
    setMicLevel(0);
    playSound('tap');
    stopRef.current?.(false);

    if (useGroq) {
      void startGroqListening();
      return;
    }
    startWebListening();
  }, [challenge, current, recording, revealed, startGroqListening, startWebListening, useGroq, voicePhase]);

  const handleMicClick = () => {
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
    ignoreResultRef.current = true;
    stopRef.current?.(false);
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
    ignoreResultRef.current = true;
    stopRef.current?.(false);
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

  const micBusy = recording || voicePhase === 'analyzing';
  const phaseLabel =
    voicePhase === 'analyzing'
      ? t('speakProcessing', locale)
      : recording
        ? t('speakMicStop', locale)
        : t('speakGameMic', locale);

  const liveHint =
    voicePhase === 'analyzing'
      ? t('speakAnalyzingHint', locale)
      : recording
        ? liveHeard
          ? t('speakHeardLive', locale).replace('{text}', liveHeard)
          : heardVoice
            ? t('speakListening', locale)
            : t('speakStatusListen', locale)
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
          <p className="speak-game-cue">{t(challenge.cueKey, locale)}</p>
          <SpeakPhraseLive phraseDisplay={challenge.phraseDisplay} spoken={liveHeard || heard} />
          <HearButton text={challenge.phraseSpeech} lang={challenge.lang} locale={locale} />
        </div>

        <p
          className={`speak-game-status speak-game-status--${revealed ? 'result' : voicePhase === 'analyzing' ? 'process' : recording ? 'listen' : 'ready'}`}
          role="status"
        >
          {revealed
            ? t('speakStatusResult', locale)
            : voicePhase === 'analyzing'
              ? t('speakStatusProcess', locale)
              : recording
                ? t('speakStatusListen', locale)
                : t('speakStatusReady', locale)}
        </p>

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
                className={`speak-game-mic-wrap${micBusy ? ' speak-game-mic-wrap--active' : ''}${voicePhase === 'analyzing' ? ' speak-game-mic-wrap--analyzing' : ''}${heardVoice && recording ? ' speak-game-mic-wrap--heard' : ''}`}
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
                  className={`speak-game-mic${recording ? ' speak-game-mic--active' : ''}${heardVoice && recording ? ' speak-game-mic--heard' : ''}`}
                  onClick={handleMicClick}
                  disabled={voicePhase === 'analyzing'}
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
              {!recording && voicePhase !== 'analyzing' && groqProbe === 'missing_key' && (
                <p className="speak-game-error">{t('speakServerMissing', locale)}</p>
              )}
              {showFallback && (
                <div className="speak-game-fallback speak-game-fallback--compact">
                  <p className="speak-game-fallback-hint">{t('speakFallbackHint', locale)}</p>
                  <button type="button" className="btn-secondary btn-lg" onClick={confirmSelfCheck}>
                    {t('speakSelfCheck', locale)}
                  </button>
                </div>
              )}
              {!recording && voicePhase !== 'analyzing' && !micError && (
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

function SpeakPhraseLive({ phraseDisplay, spoken }: { phraseDisplay: string; spoken: string }) {
  return (
    <p className="speak-game-phrase">
      {parsePhraseDisplay(phraseDisplay).map((part, i) => (
        <span key={i} className={part.kind === 'term' ? 'speak-game-target' : undefined}>
          {part.value.split(/(\s+)/).map((piece, j) => {
            if (!piece || /^\s+$/.test(piece)) return <span key={j}>{piece}</span>;
            const hit = wordIsHeardInTranscript(piece, spoken);
            return (
              <span key={j} className={hit ? 'speak-game-word--heard' : undefined}>
                {piece}
              </span>
            );
          })}
        </span>
      ))}
    </p>
  );
}
