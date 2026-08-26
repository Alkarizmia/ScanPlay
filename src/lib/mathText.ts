/** Detect LaTeX produced by vision — not a hardcoded formula list. */
const LATEX_COMMAND =
  /\\(frac|sqrt|pm|mp|cdot|times|div|leq|geq|neq|in|notin|subset|infty|sum|int|lim|to|rightarrow|leftarrow|mathbb|mathrm|mathbf|vec|overline|hat|bar|partial|nabla|circ|degree|sin|cos|tan|log|ln|exp|left|right|begin|end)\b/;

const LATEX_SHORTHAND = /\\[a-zA-Z]+|\\\{|\\\}|\\,|\\;|\^\{|_\{/;

export function unwrapLatexDelimiters(raw: string): string {
  let s = raw.trim();
  if ((s.startsWith('$$') && s.endsWith('$$') && s.length > 4) || (s.startsWith('$') && s.endsWith('$') && s.length > 2)) {
    s = s.replace(/^\$+|\$+$/g, '').trim();
  }
  if (s.startsWith('\\(') && s.endsWith('\\)')) {
    s = s.slice(2, -2).trim();
  }
  if (s.startsWith('\\[') && s.endsWith('\\]')) {
    s = s.slice(2, -2).trim();
  }
  return s;
}

export function looksLikeLatex(text: string): boolean {
  const s = unwrapLatexDelimiters(text);
  if (s.length < 2) return false;
  if (LATEX_COMMAND.test(s) || LATEX_SHORTHAND.test(s)) return true;
  if (/\$[^$]+\$/.test(text)) return true;
  return false;
}

export function shouldRenderLatex(text: string): boolean {
  return looksLikeLatex(text);
}
