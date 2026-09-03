import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HearButton } from '../HearButton';
import { getExamTimerSeconds } from '../../lib/examTimer';
import { playSound } from '../../lib/sounds';
import { registerAnswer } from '../../lib/gameFeedback';
import { FormulaText } from '../FormulaText';
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
import { resolveSideLang } from '../../lib/speakLang';
import type { Locale, SheetType, WordPair } from '../../types';
import { ReportErrorSheet } from '../ReportErrorSheet';
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';
import { AnswerFeedback } from './AnswerFeedback';
import { ChoiceCard, type ChoiceState } from './ChoiceCard';

interface TypeGameProps extends EmbeddedGameProps {
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
  embedded = false,
  onStepProgress,
  maxItems,
}: TypeGameProps) {
  const pool = useMemo(() => coercePlayablePairs(pairs), [pairs]);
  const total = Math.min(pool.length, examMode ? 8 : (maxItems ?? 6));
  const deck = pool.slice(0, total);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [grade, setGrade] = useState<AnswerGrade>('wrong');
  const [lastXp, setLastXp] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  const current = deck[index];
  const mathLike =
    sheetType === 'math' ||
    Boolean(current && (isMathLikeText(current.term) || isMathLikeText(current.definition)));
  const useVisual = sheetType === 'vocab' && Boolean(current?.visual) && !mathLike;
  const typeKeyword = sheetType === 'definitions' || sheetType === 'notes';
  const prompt = useVisual ? '' : typeKeyword ? (current?.definition ?? '') : (current?.term ?? '');
  const expected = typeKeyword ? (current?.term ?? '') : (current?.definition ?? '');
  const choiceOptions = useMemo(() => {
    if (!current || mathLike || !isLongExpectedAnswer(expected)) return [];
    return pickTypeGameOptions(current, pool, 3, `${deckId ?? 'type'}-${index}-${expected.slice(0, 12)}`);
  }, [current, mathLike, expected, pool, deckId, index]);
  const useChoiceMode = !mathLike && isLongExpectedAnswer(expected) && choiceOptions.length >= MIN_CHOICE_OPTIONS;
  const timerSeconds = examMode ? getExamTimerSeconds('type', total) : 0;
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, total);
  }, [embedded, onStepProgress, index, total]);

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
    setLastXp(0);
    if (!useChoiceMode) inputRef.current?.focus();
  }, [index, useChoiceMode]);

  const finish = useCallback(
    (finalScore: number) => onComplete(finalScore, total),
    [onComplete, total],
  );

  const applyGrade = (g: AnswerGrade) => {
    setGrade(g);
    setRevealed(true);
    setLastXp(registerAnswer(g, { pathStep: stepIndex != null }));

    if (g === 'correct') {
      const newScore = score + 1;
      setScore(newScore);
      scoreRef.current = newScore;
      if (current) markCorrected(current);
    } else if (g === 'near') {
      const newScore = score + 0.5;
      setScore(newScore);
      scoreRef.current = newScore;
    } else if (current) {
      recordMistake(current, 'type', deckId ?? undefined, stepIndex ?? undefined);
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
    <LessonGameShell
      embedded={embedded}
      locale={locale}
      onExit={onExit}
      progress={gameProgressPct(index + 1, total)}
      examMode={examMode}
      timeLeft={timeLeft}
      feedback={
        revealed ? (
          <AnswerFeedback
            locale={locale}
            grade={grade}
            xp={lastXp}
            answer={grade === 'correct' ? undefined : <FormulaText text={expected} />}
            note={
              grade === 'near' ? (
                <>
                  {t('typeNearHint', locale)}
                  {input.trim() && (
                    <>
                      {' · '}
                      {t('typeYouWrote', locale)}: <em>{input.trim()}</em>
                    </>
                  )}
                </>
              ) : undefined
            }
          />
        ) : null
      }
    >
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
            <h2 className="type-game-term">
              <FormulaText text={prompt} />
            </h2>
            <HearButton
              text={typeKeyword ? current.definition : current.term}
              lang={resolveSideLang(current, typeKeyword ? 'def' : 'term')}
              locale={locale}
            />
          </div>
        )}

        {useChoiceMode ? (
          <div className="choice-list type-game-options">
            {choiceOptions.map((opt, i) => {
              const state: ChoiceState = !revealed
                ? 'idle'
                : opt === expected
                  ? 'correct'
                  : opt === selectedOption
                    ? 'wrong'
                    : 'muted';
              return (
                <ChoiceCard
                  key={opt}
                  index={i}
                  state={state}
                  disabled={revealed}
                  onSelect={() => pickOption(opt)}
                >
                  <FormulaText text={opt} />
                </ChoiceCard>
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
    </LessonGameShell>
  );
}
