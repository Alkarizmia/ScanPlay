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
import { resolvePairCartoon } from '../../lib/cartoonArt';
import { resolveSideLang } from '../../lib/speakLang';
import { useGameIdleHelp } from '../../hooks/useGameIdleHelp';
import type { Locale, SheetType, WordPair } from '../../types';
import { ReportErrorSheet } from '../ReportErrorSheet';
import { gameProgressPct } from './GameHeader';
import type { EmbeddedGameProps } from './embeddedGame';
import { LessonGameShell } from './LessonGameShell';
import { AnswerFeedback } from './AnswerFeedback';
import { ChoiceCard, type ChoiceState } from './ChoiceCard';
import { MathAnswerKeyboard } from './MathAnswerKeyboard';
import { IdleHelpChip } from './IdleHelpChip';

interface TypeGameProps extends EmbeddedGameProps {
  pairs: WordPair[];
  locale: Locale;
  examMode?: boolean;
  deckId?: string | null;
  stepIndex?: number | null;
  sheetType?: SheetType;
  /**
   * Which side the learner must produce.
   * `definition` = classic scan decks (term → type translation).
   * `term` = English Universe (see image/native → type English).
   */
  targetSide?: 'term' | 'definition';
  onAnswer?: (pair: WordPair, correct: boolean) => void;
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
  targetSide = 'definition',
  onAnswer,
  onComplete,
  onExit,
  onToast,
  embedded = false,
  onStepProgress,
  maxItems,
}: TypeGameProps) {
  const formulaSheet = sheetType === 'math' || sheetType === 'definitions';
  const pool = useMemo(
    () => coercePlayablePairs(pairs, formulaSheet ? { mathSheet: true } : undefined),
    [pairs, formulaSheet],
  );
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
    formulaSheet ||
    Boolean(current && (isMathLikeText(current.term) || isMathLikeText(current.definition)));
  const cartoonRaw = current ? resolvePairCartoon(current.term, current.definition) : null;
  // Desk/office table art looks like a stool — prefer the desk emoji for those words.
  const deskLike =
    Boolean(current) &&
    /\b(office|desk|bureau|escritorio)\b/i.test(`${current?.term ?? ''} ${current?.definition ?? ''}`);
  const cartoon = deskLike && cartoonRaw?.id === 'table' ? null : cartoonRaw;
  const visualEmoji = deskLike ? (current?.visual || '🖥️') : current?.visual;
  const useVisual =
    sheetType === 'vocab' && !mathLike && Boolean(cartoon || visualEmoji);
  const typeKeyword = sheetType === 'definitions' || sheetType === 'notes';
  const produceTerm = !typeKeyword && targetSide === 'term';
  const prompt = useVisual
    ? ''
    : typeKeyword
      ? (current?.definition ?? '')
      : produceTerm
        ? (current?.definition ?? '')
        : (current?.term ?? '');
  const expected = typeKeyword
    ? (current?.term ?? '')
    : produceTerm
      ? (current?.term ?? '')
      : (current?.definition ?? '');
  const choiceOptions = useMemo(() => {
    if (!current || mathLike || !isLongExpectedAnswer(expected)) return [];
    return pickTypeGameOptions(
      current,
      pool,
      3,
      `${deckId ?? 'type'}-${index}-${expected.slice(0, 12)}`,
      produceTerm ? 'term' : 'definition',
    );
  }, [current, mathLike, expected, pool, deckId, index, produceTerm]);
  const useChoiceMode = !mathLike && isLongExpectedAnswer(expected) && choiceOptions.length >= MIN_CHOICE_OPTIONS;
  const mathSeedTexts = useMemo(() => {
    if (!mathLike) return [];
    return deck.flatMap((p) => [p.term, p.definition]);
  }, [mathLike, deck]);
  const timerSeconds = examMode ? getExamTimerSeconds('type', total) : 0;
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [reportOpen, setReportOpen] = useState(false);

  const idleEnabled = !examMode && !revealed && !useChoiceMode && !mathLike;
  const { helped: idleHelped, secondsLeft: idleSeconds, bumpActivity } = useGameIdleHelp({
    enabled: idleEnabled,
    resetKey: `${index}-${expected}`,
  });

  useEffect(() => {
    if (embedded && onStepProgress) onStepProgress(index, total);
  }, [embedded, onStepProgress, index, total]);

  // Never leave a blank embedded lesson step when the pair was filtered out.
  const emptySkipRef = useRef(false);
  useEffect(() => {
    if (pool.length > 0 || emptySkipRef.current) return;
    emptySkipRef.current = true;
    onComplete(0, 1);
  }, [pool.length, onComplete]);

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
    if (!useChoiceMode && !mathLike) inputRef.current?.focus();
  }, [index, useChoiceMode, mathLike]);

  const finish = useCallback(
    (finalScore: number) => onComplete(finalScore, total),
    [onComplete, total],
  );

  const applyGrade = (g: AnswerGrade) => {
    setGrade(g);
    setRevealed(true);
    setLastXp(registerAnswer(g, { pathStep: stepIndex != null }));
    if (current) onAnswer?.(current, g === 'correct' || g === 'near');

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
    bumpActivity();
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

  if (!current) {
    return (
      <LessonGameShell embedded={embedded} locale={locale} onExit={onExit} progress={0}>
        <div className="game-body type-game-body">
          <p className="quiz-empty-msg">{t('stepNeedMoreWords', locale)}</p>
          <button type="button" className="btn-primary" onClick={() => onComplete(0, 1)}>
            {t('typeNext', locale)}
          </button>
        </div>
      </LessonGameShell>
    );
  }

  const promptKey = useChoiceMode
    ? 'typePromptChoice'
    : useVisual
      ? produceTerm
        ? 'typeVisualPromptTarget'
        : 'typeVisualPrompt'
      : mathLike
        ? 'typePromptMath'
        : produceTerm
          ? 'typePromptTarget'
          : 'typePrompt';

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
      <div className={`game-body type-game-body${mathLike && !useChoiceMode ? ' type-game-body--math' : ''}`}>
        <p className="type-game-prompt">{t(promptKey, locale)}</p>
        {useVisual ? (
          <div className="type-game-visual-wrap">
            <div className="type-game-visual" aria-hidden="true">
              {cartoon ? (
                <img src={cartoon.src} alt="" className="type-game-visual-img" draggable={false} />
              ) : (
                visualEmoji
              )}
            </div>
            {idleHelped && !revealed && (
              <div className="idle-help-answer idle-help-answer--reveal" aria-live="polite">
                <span className="idle-help-answer-main">{expected}</span>
                {produceTerm && current.definition && (
                  <span className="idle-help-answer-gloss">{current.definition}</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="type-game-term-row">
            <h2 className="type-game-term">
              <FormulaText text={prompt} />
            </h2>
            {!mathLike && (
              <HearButton
                text={produceTerm || typeKeyword ? current.definition : current.term}
                lang={resolveSideLang(current, produceTerm || typeKeyword ? 'def' : 'term')}
                locale={locale}
              />
            )}
          </div>
        )}

        {idleEnabled && (
          <IdleHelpChip locale={locale} helped={idleHelped} secondsLeft={idleSeconds} />
        )}

        {!useVisual && idleHelped && !revealed && (
          <div className="idle-help-answer idle-help-answer--reveal" aria-live="polite">
            <span className="idle-help-answer-main">{expected}</span>
            {produceTerm && current.definition && (
              <span className="idle-help-answer-gloss">{current.definition}</span>
            )}
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
                  nudge={!revealed && idleHelped && opt === expected}
                  onSelect={() => pickOption(opt)}
                >
                  <FormulaText text={opt} />
                </ChoiceCard>
              );
            })}
          </div>
        ) : mathLike ? (
          <MathAnswerKeyboard
            key={index}
            value={input}
            onChange={(v) => {
              bumpActivity();
              setInput(v);
            }}
            seedTexts={mathSeedTexts}
            locale={locale}
            disabled={revealed}
          />
        ) : (
          <>
            <label className="field-label" htmlFor="type-answer">
              {t('typeAnswerLabel', locale)}
            </label>
            <input
              id="type-answer"
              ref={inputRef}
              className="field-input type-game-input"
              value={input}
              onChange={(e) => {
                bumpActivity();
                setInput(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (revealed) next();
                  else submit();
                }
              }}
              placeholder={t(produceTerm ? 'typePlaceholderTarget' : 'typePlaceholder', locale)}
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
