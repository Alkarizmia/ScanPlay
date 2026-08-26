import { describe, expect, it } from 'vitest';
import { looksLikeLatex, shouldRenderLatex, unwrapLatexDelimiters } from './mathText';

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
});
