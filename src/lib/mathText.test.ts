import { describe, expect, it } from 'vitest';
import {
  collectMathKeyboardAtoms,
  latexToComparablePlain,
  looksLikeLatex,
  mathComparableVariants,
  shouldRenderLatex,
  unwrapLatexDelimiters,
} from './mathText';

describe('mathText', () => {
  it('detects LaTeX commands from vision, not a canned example', () => {
    expect(looksLikeLatex('\\frac{a}{b}')).toBe(true);
    expect(looksLikeLatex('\\pm\\sqrt{3}')).toBe(true);
    expect(looksLikeLatex('\\mathrm{H_2O}')).toBe(true);
    expect(looksLikeLatex('F = ma')).toBe(false);
    expect(looksLikeLatex('le fils')).toBe(false);
    expect(looksLikeLatex('de zoon')).toBe(false);
  });

  it('unwraps dollar delimiters', () => {
    expect(unwrapLatexDelimiters('$\\sqrt{2}$')).toBe('\\sqrt{2}');
    expect(shouldRenderLatex('$\\int_0^1 x dx$')).toBe(true);
  });

  it('compares plain keyboard math with LaTeX', () => {
    expect(latexToComparablePlain('\\cos x')).toBe(latexToComparablePlain('cos x'));
    expect(mathComparableVariants('cos x').some((v) => mathComparableVariants('\\cos x').includes(v))).toBe(
      true,
    );
    expect(
      mathComparableVariants('1/(2√x)').some((v) =>
        mathComparableVariants('\\frac{1}{2\\sqrt{x}}').includes(v),
      ),
    ).toBe(true);
  });

  it('collects keyboard atoms from scanned formulas', () => {
    const atoms = collectMathKeyboardAtoms(['\\sin x', '\\cos x', 'x^n']);
    expect(atoms).toEqual(expect.arrayContaining(['sin', 'cos', 'x', 'n']));
  });
});
