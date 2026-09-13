import { useMemo, useState } from 'react';
import { FormulaText } from '../FormulaText';
import { collectMathKeyboardAtoms } from '../../lib/mathText';
import { t } from '../../lib/i18n';
import type { Locale } from '../../types';

interface MathAnswerKeyboardProps {
  value: string;
  onChange: (next: string) => void;
  seedTexts: string[];
  locale: Locale;
  disabled?: boolean;
}

type FracPhase = 'off' | 'num' | 'den';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;
const OPS = [
  { label: '+', insert: '+' },
  { label: '−', insert: '-' },
  { label: '×', insert: '\\cdot ' },
  { label: '/', insert: '/' },
  { label: '=', insert: '=' },
  { label: '(', insert: '(' },
  { label: ')', insert: ')' },
  { label: '^', insert: '^' },
  { label: "'", insert: "'" },
] as const;

function appendToken(base: string, token: string): string {
  if (!token) return base;
  if (!base) return token.trimStart();
  if (/^[A-Za-z\\]/.test(token) && /[A-Za-z0-9)]$/.test(base.trimEnd())) {
    return `${base}\\ ${token}`;
  }
  return base + token;
}

export function MathAnswerKeyboard({
  value,
  onChange,
  seedTexts,
  locale,
  disabled = false,
}: MathAnswerKeyboardProps) {
  const [fracPhase, setFracPhase] = useState<FracPhase>('off');
  const [fracNum, setFracNum] = useState('');
  const [fracDen, setFracDen] = useState('');

  const atoms = useMemo(() => collectMathKeyboardAtoms(seedTexts), [seedTexts]);

  const preview =
    fracPhase === 'off'
      ? value
      : fracPhase === 'num'
        ? `${value}${value ? ' ' : ''}\\frac{${fracNum || '\\square'}}{\\square}`
        : `${value}${value ? ' ' : ''}\\frac{${fracNum || '\\square'}}{${fracDen || '\\square'}}`;

  const push = (token: string) => {
    if (disabled) return;
    if (fracPhase === 'num') {
      setFracNum((n) => appendToken(n, token));
      return;
    }
    if (fracPhase === 'den') {
      setFracDen((d) => appendToken(d, token));
      return;
    }
    onChange(appendToken(value, token));
  };

  const backspace = () => {
    if (disabled) return;
    if (fracPhase === 'den') {
      if (fracDen) setFracDen((d) => d.slice(0, -1));
      else setFracPhase('num');
      return;
    }
    if (fracPhase === 'num') {
      if (fracNum) setFracNum((n) => n.slice(0, -1));
      else setFracPhase('off');
      return;
    }
    onChange(value.slice(0, -1));
  };

  const clearAll = () => {
    if (disabled) return;
    setFracPhase('off');
    setFracNum('');
    setFracDen('');
    onChange('');
  };

  const startOrAdvanceFraction = () => {
    if (disabled) return;
    if (fracPhase === 'off') {
      setFracPhase('num');
      setFracNum('');
      setFracDen('');
      return;
    }
    if (fracPhase === 'num') {
      setFracPhase('den');
      return;
    }
    if (!fracNum.trim() || !fracDen.trim()) return;
    onChange(appendToken(value, `\\frac{${fracNum.trim()}}{${fracDen.trim()}}`));
    setFracPhase('off');
    setFracNum('');
    setFracDen('');
  };

  return (
    <div className={`math-answer-keyboard${disabled ? ' is-disabled' : ''}`}>
      <div className="math-answer-preview" aria-live="polite">
        {preview.trim() ? (
          <FormulaText text={preview} />
        ) : (
          <span className="math-answer-preview-ph">{t('mathKeyPreviewEmpty', locale)}</span>
        )}
      </div>

      {fracPhase !== 'off' && (
        <p className="math-answer-frac-hint">
          {fracPhase === 'num' ? t('mathKeyFracNum', locale) : t('mathKeyFracDen', locale)}
        </p>
      )}

      <div className="math-key-row math-key-row--atoms">
        {atoms.map((atom) => (
          <button
            key={atom}
            type="button"
            className="math-key math-key--atom"
            disabled={disabled}
            onClick={() => push(atom.length > 1 ? `\\${atom} ` : atom)}
          >
            {atom}
          </button>
        ))}
        <button type="button" className="math-key math-key--op" disabled={disabled} onClick={() => push('\\sqrt{')}>
          √
        </button>
        <button
          type="button"
          className={`math-key math-key--frac${fracPhase !== 'off' ? ' is-active' : ''}`}
          disabled={disabled}
          onClick={startOrAdvanceFraction}
        >
          {fracPhase === 'off' ? 'a/b' : fracPhase === 'num' ? '↓' : '✓'}
        </button>
      </div>

      <div className="math-key-row math-key-row--digits">
        {DIGITS.map((d) => (
          <button key={d} type="button" className="math-key" disabled={disabled} onClick={() => push(d)}>
            {d}
          </button>
        ))}
      </div>

      <div className="math-key-row">
        {OPS.map((op) => (
          <button
            key={op.label}
            type="button"
            className="math-key math-key--op"
            disabled={disabled}
            onClick={() => push(op.insert)}
          >
            {op.label}
          </button>
        ))}
        <button type="button" className="math-key math-key--op" disabled={disabled} onClick={() => push('}')}>
          {'}'}
        </button>
        <button type="button" className="math-key math-key--danger" disabled={disabled} onClick={backspace}>
          ⌫
        </button>
        <button type="button" className="math-key math-key--danger" disabled={disabled} onClick={clearAll}>
          {t('mathKeyClear', locale)}
        </button>
      </div>
    </div>
  );
}
