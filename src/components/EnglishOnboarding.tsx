import { useMemo, useState } from 'react';
import {
  CEFR_LEVELS,
  PLACEMENT_ITEMS,
  type CefrLevel,
  type EnglishGoal,
  type EnglishNativeLang,
} from '../lib/englishCurriculum';
import { estimateLevelFromPlacement, saveUniverseEnglishOnboarding } from '../lib/universeEnglish';
import { playSound } from '../lib/sounds';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

type Step = 'path' | 'level' | 'test' | 'goal' | 'native';

interface EnglishOnboardingProps {
  locale: Locale;
  onDone: () => void;
}

const GOALS: EnglishGoal[] = ['travel', 'work', 'school', 'exam', 'fun', 'other'];
const NATIVES: EnglishNativeLang[] = ['fr', 'nl', 'es', 'ar'];

export function EnglishOnboarding({ locale, onDone }: EnglishOnboardingProps) {
  const [step, setStep] = useState<Step>('path');
  const [level, setLevel] = useState<CefrLevel>('A1');
  const [goal, setGoal] = useState<EnglishGoal>('travel');
  const [nativeLang, setNativeLang] = useState<EnglishNativeLang>(
    locale === 'nl' || locale === 'es' || locale === 'ar' ? locale : 'fr',
  );
  const [testIndex, setTestIndex] = useState(0);
  const [testLog, setTestLog] = useState<{ correct: boolean; levelHint: CefrLevel }[]>([]);

  const uiLang: EnglishNativeLang =
    locale === 'en' ? 'fr' : locale === 'nl' || locale === 'es' || locale === 'ar' ? locale : 'fr';

  const placement = useMemo(() => PLACEMENT_ITEMS[testIndex], [testIndex]);

  const finish = (finalLevel: CefrLevel) => {
    saveUniverseEnglishOnboarding({ level: finalLevel, goal, nativeLang });
    playSound('levelUp');
    onDone();
  };

  const answerTest = (choiceIndex: number) => {
    if (!placement) return;
    const ok = choiceIndex === placement.correct;
    if (ok) playSound('correct');
    else playSound('wrong');
    const entry = { correct: ok, levelHint: placement.levelHint };
    const nextLog = [...testLog, entry];
    if (testIndex + 1 >= PLACEMENT_ITEMS.length) {
      const estimated = estimateLevelFromPlacement(nextLog);
      setLevel(estimated);
      setTestLog(nextLog);
      setStep('goal');
      return;
    }
    setTestLog(nextLog);
    setTestIndex((i) => i + 1);
  };

  return (
    <div className="english-onboard">
      {step === 'path' && (
        <section className="english-onboard-card">
          <p className="english-onboard-kicker">{t('engCourseTitle', locale)}</p>
          <h3 className="english-onboard-title">{t('engOnboardWelcome', locale)}</h3>
          <p className="english-onboard-sub">{t('engOnboardWelcomeSub', locale)}</p>
          <button
            type="button"
            className="btn-primary english-onboard-cta"
            onClick={() => {
              playSound('tap');
              setStep('level');
            }}
          >
            {t('engChooseLevel', locale)}
          </button>
          <button
            type="button"
            className="btn-secondary english-onboard-cta"
            onClick={() => {
              playSound('tap');
              setTestIndex(0);
              setTestLog([]);
              setStep('test');
            }}
          >
            {t('engTakeTest', locale)}
          </button>
        </section>
      )}

      {step === 'level' && (
        <section className="english-onboard-card">
          <h3 className="english-onboard-title">{t('engPickLevel', locale)}</h3>
          <p className="english-onboard-sub">{t('engPickLevelSub', locale)}</p>
          <div className="english-level-grid">
            {CEFR_LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                className={`english-level-chip${level === lv ? ' active' : ''}`}
                onClick={() => {
                  playSound('tap');
                  setLevel(lv);
                }}
              >
                {lv}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-primary english-onboard-cta"
            onClick={() => {
              playSound('tap');
              setStep('goal');
            }}
          >
            {t('engNext', locale)}
          </button>
        </section>
      )}

      {step === 'test' && placement && (
        <section className="english-onboard-card">
          <p className="english-onboard-kicker">
            {t('engTestProgress', locale)
              .replace('{n}', String(testIndex + 1))
              .replace('{total}', String(PLACEMENT_ITEMS.length))}
          </p>
          <h3 className="english-onboard-title">{t('engTestPrompt', locale)}</h3>
          <p className="english-test-word">{placement.en}</p>
          {placement.sentence && <p className="english-test-sentence">{placement.sentence}</p>}
          <div className="english-test-choices">
            {placement.choices.map((c, i) => (
              <button
                key={i}
                type="button"
                className="english-test-choice"
                onClick={() => answerTest(i)}
              >
                {c[uiLang]}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'goal' && (
        <section className="english-onboard-card">
          <h3 className="english-onboard-title">{t('engPickGoal', locale)}</h3>
          <p className="english-onboard-sub">{t('engPickGoalSub', locale)}</p>
          {testLog.length > 0 && (
            <p className="english-onboard-sub english-test-result">
              {t('engTestResult', locale).replace('{level}', level)}
            </p>
          )}
          <div className="english-goal-list">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                className={`english-goal-row${goal === g ? ' active' : ''}`}
                onClick={() => {
                  playSound('tap');
                  setGoal(g);
                  if (testLog.length > 0) {
                    setLevel(estimateLevelFromPlacement(testLog, g));
                  }
                }}
              >
                {t(`engGoal_${g}` as 'engGoal_travel', locale)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-primary english-onboard-cta"
            onClick={() => {
              playSound('tap');
              setStep('native');
            }}
          >
            {t('engNext', locale)}
          </button>
        </section>
      )}

      {step === 'native' && (
        <section className="english-onboard-card">
          <h3 className="english-onboard-title">{t('engPickNative', locale)}</h3>
          <p className="english-onboard-sub">{t('engPickNativeSub', locale)}</p>
          <div className="english-goal-list">
            {NATIVES.map((lang) => (
              <button
                key={lang}
                type="button"
                className={`english-goal-row${nativeLang === lang ? ' active' : ''}`}
                onClick={() => {
                  playSound('tap');
                  setNativeLang(lang);
                }}
              >
                {t(`engNative_${lang}` as 'engNative_fr', locale)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-primary english-onboard-cta"
            onClick={() => finish(level)}
          >
            {t('engStartLearning', locale)}
          </button>
        </section>
      )}
    </div>
  );
}
