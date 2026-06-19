import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HearButton } from '../HearButton';
import { getExamTimerSeconds } from '../../lib/examTimer';
import { playGameCorrectSound, playSound } from '../../lib/sounds';
import { addCorrectAnswer } from '../../lib/gamification';
import { vibrateError, vibrateSuccess } from '../../lib/haptics';
import { t } from '../../lib/i18n';
import { markCorrected, recordMistake } from '../../lib/mistakes';
import {
  coercePlayablePairs,
  gradeTypedAnswer,
  isLongExpectedAnswer,
  isMathLikeText,
  pickTypeGameOptions,
  type AnswerGrade,
} from '../../lib/vocabulary';
import { resolveSpeakLang } from '../../lib/speakLang';
import type { Locale, SheetType, WordPair } from '../../types';
import { ReportErrorSheet } from '../ReportErrorSheet';
import { gameProgressPct, GameHeader } from './GameHeader';

interface TypeGameProps {
  pairs: WordPair[];
  locale: Locale;
  examMode?: boolean;
  deckId?: string | null;
  stepIndex?: number | null;
  sheetType?: SheetType;
  onComplete: (score: number, total: number) => void;
  onExit: () => void;
  onToast?: (message: string) => void;
}

const MIN_CHOICE_OPTIONS = 4;

export function TypeGame({
  pairs,
  locale,
  examMode,
  deckId,
  stepIndex,
  sheetType = 'vocab',
  onComplete,
  onExit,
  onToast,
}: TypeGameProps) {
  const pool = useMemo(() => coercePlayablePairs(pairs), [pairs]);
  const total = Math.min(pool.length, examMode ? 8 : 6);
  const deck = pool.slice(0, total);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [grade, setGrade] = useState<AnswerGrade>('wrong');
  const inputRef = useRef<HTMLInputElement>(null);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  const current = deck[index];
  const mathLike =
    sheetType === 'math' ||
    Boolean(current && (isMathLikeText(current.term) || isMathLikeText(current.definition)));
  const useVisual = sheetType === 'vocab' && Boolean(current?.visual) && !mathLike;
  const prompt = useVisual ? '' : (current?.term ?? '');
  const expected = current?.definition ?? '';
  const choiceOptions = useMemo(() => {
    if (!current || mathLike || !isLongExpectedAnswer(expected)) return [];
    return pickTypeGameOptions(current, pool, 3, `${deckId ?? 'type'}-${index}-${expected.slice(0, 12)}`);
  }, [current, mathLike, expected, pool, deckId, index]);
  const useChoiceMode = !mathLike && isLongExpectedAnswer(expected) && choiceOptions.length >= MIN_CHOICE_OPTIONS;
  const timerSeconds = examMode ? getExamTimerSeconds('type', total) : 0;
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [reportOpen, setReportOpen] = useState(false);

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
    setInput('');
    setSelectedOption(null);
    setRevealed(false);
    setGrade('wrong');
    if (!useChoiceMode) inputRef.current?.focus();
  }, [index, useChoiceMode]);

  const finish = useCallback(
    (finalScore: number) => onComplete(finalScore, total),
    [onComplete, total],
  );

  const applyGrade = (g: AnswerGrade) => {
    setGrade(g);
    setRevealed(true);
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
      if (current) recordMistake(current, 'type', deckId ?? undefined, stepIndex ?? undefined);
      vibrateError();
      playSound('wrong');
    }
  };

  const submit = (typed = input) => {
    if (!current || revealed) return;
    applyGrade(gradeTypedAnswer(typed, expected, mathLike));
  };

  const pickOption = (opt: string) => {
    if (!current || revealed) return;
    setSelectedOption(opt);
    applyGrade(opt === expected ? 'correct' : 'wrong');
  };

  const next = () => {
    if (index >= total - 1) {
      finish(scoreRef.current);
      return;
    }
    setIndex((i) => i + 1);
  };

  if (!current) return null;

  return (
    <div className="screen game-screen flow-screen">
      <GameHeader
        locale={locale}
        onExit={onExit}
        progress={gameProgressPct(index + 1, total)}
        examMode={examMode}
        timeLeft={timeLeft}
      />

      <div className="game-body type-game-body">
        <p className="type-game-prompt">
          {useChoiceMode
            ? t('typePromptChoice', locale)
            : useVisual
              ? t('typeVisualPrompt', locale)
              : mathLike
                ? t('typePromptMath', locale)
                : t('typePrompt', locale)}
        </p>
        {useVisual ? (
          <div className="type-game-visual" aria-hidden="true">
            {current.visual}
          </div>
        ) : (
          <div className="type-game-term-row">
            <h2 className="type-game-term">{prompt}</h2>
            <HearButton text={current.term} lang={resolveSpeakLang(current)} locale={locale} />
          </div>
        )}

        {useChoiceMode ? (
          <div className="quiz-options type-game-options">
            {choiceOptions.map((opt) => {
              let cls = 'quiz-option';
              if (revealed && opt === expected) cls += ' correct';
              else if (revealed && opt === selectedOption && opt !== expected) cls += ' wrong';
              return (
                <button
                  key={opt}
                  type="button"
                  className={cls}
                  onClick={() => pickOption(opt)}
                  disabled={revealed}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <label className="field-label" htmlFor="type-answer">
              {mathLike ? t('typePromptMath', locale) : t('typeAnswerLabel', locale)}
            </label>
            <input
              id="type-answer"
              ref={inputRef}
              className="field-input type-game-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (revealed) next();
                  else submit();
                }
              }}
              placeholder={t('typePlaceholder', locale)}
              disabled={revealed}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
            />
          </>
        )}

        {revealed && (
          <p className={`type-game-feedback ${grade === 'wrong' ? 'wrong' : 'correct'}`}>
            {grade === 'correct' && t('typeCorrect', locale)}
            {grade === 'near' && (
              <>
                {t('typeNear', locale)}{' '}
                <span className="type-game-expected type-game-expected--near">{expected}</span>
                <span className="type-game-near-hint"> · {t('typeNearHint', locale)}</span>
                {input.trim() && (
                  <span className="type-game-you-wrote">
                    {' '}
                    ({t('typeYouWrote', locale)}: <em>{input.trim()}</em>)
                  </span>
                )}
              </>
            )}
            {grade === 'wrong' && (
              <>
                {t('typeWrong', locale)}
                <span className="type-game-expected"> → {expected}</span>
              </>
            )}
          </p>
        )}
      </div>

      <div className={`game-actions${revealed && grade === 'wrong' ? ' game-actions--stacked' : ''}`}>
        {useChoiceMode ? (
          <button type="button" className="btn-primary btn-lg" onClick={next} disabled={!revealed}>
            {index >= total - 1 ? t('typeFinish', locale) : t('typeNext', locale)}
          </button>
        ) : !revealed ? (
          <button type="button" className="btn-primary btn-lg" onClick={() => submit()} disabled={!input.trim()}>
            {t('typeCheck', locale)}
          </button>
        ) : (
          <>
            <button type="button" className="btn-primary btn-lg" onClick={next}>
              {index >= total - 1 ? t('typeFinish', locale) : t('typeNext', locale)}
            </button>
            {grade === 'wrong' && (
              <button type="button" className="btn-secondary btn-lg" onClick={() => setReportOpen(true)}>
                {t('reportErrorBtn', locale)}
              </button>
            )}
          </>
        )}
      </div>

      {reportOpen && current && (
        <ReportErrorSheet
          locale={locale}
          context={{
            game: 'type',
            sheetType,
            locale,
            prompt,
            expected,
            userAnswer: useChoiceMode ? (selectedOption ?? '') : input.trim(),
            grade,
            deckId,
            stepIndex,
            questionIndex: index,
            questionTotal: total,
          }}
          onClose={() => setReportOpen(false)}
          onSent={(viaMailto) => {
            onToast?.(t(viaMailto ? 'reportErrorSentMailto' : 'reportErrorSent', locale));
          }}
        />
      )}
    </div>
  );
}
