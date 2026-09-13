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

/** Strip wrappers like (x) or (1) so typed and LaTeX forms line up. */
function stripSingleTokenParens(s: string): string {
  let out = s;
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(/\(([^()*/+\-^=]+)\)/g, '$1');
  }
  return out;
}

/**
 * Turn LaTeX / unicode / plain math into a comparable string
 * so "cos x" matches "\\cos x" and "1/(2√x)" matches "\\frac{1}{2\\sqrt{x}}".
 */
export function latexToComparablePlain(raw: string): string {
  let s = unwrapLatexDelimiters(raw).trim();
  if (!s) return '';

  /* Nested roots before fractions so \\frac{1}{2\\sqrt{x}} parses. */
  for (let i = 0; i < 8; i += 1) {
    const next = s
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)')
      .replace(/\\sqrt\s*([A-Za-z0-9])/g, 'sqrt($1)');
    if (next === s) break;
    s = next;
  }

  for (let i = 0; i < 8; i += 1) {
    const next = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
    if (next === s) break;
    s = next;
  }

  s = s
    .replace(/\\(?:mathrm|mathbf|mathbb|operatorname|text)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\left|\\right/g, '')
    .replace(/\\(?:cdot|times|ast|bullet)\b/g, '*')
    .replace(/\\div\b/g, '/')
    .replace(/\\pm\b/g, '+-')
    .replace(/\\to\b|\\rightarrow\b/g, '->')
    .replace(/\\leq\b/g, '<=')
    .replace(/\\geq\b/g, '>=')
    .replace(/\\neq\b/g, '!=')
    .replace(/\\infty\b/g, 'inf')
    .replace(
      /\\(cos|sin|tan|cot|sec|csc|log|ln|exp|lim|max|min|det|gcd|arcsin|arccos|arctan)\b/gi,
      (_, name: string) => name.toLowerCase(),
    )
    .replace(/\^\{([^{}]+)\}/g, '^$1')
    .replace(/_\{([^{}]+)\}/g, '_$1')
    .replace(/\\([A-Za-z]+)/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/[×·⋅∙]/g, '*')
    .replace(/÷/g, '/')
    .replace(/√/g, 'sqrt')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\u2032/g, "'")
    .replace(/\s+/g, '')
    .toLowerCase();

  return stripSingleTokenParens(s);
}

/** Variants used when grading typed math answers. */
export function mathComparableVariants(raw: string): string[] {
  const base = latexToComparablePlain(raw);
  if (!base) return [];
  const noParens = base.replace(/[()]/g, '');
  return [...new Set([base, stripSingleTokenParens(base), noParens].filter(Boolean))];
}

const MATH_FN_KEYS = ['sin', 'cos', 'tan', 'ln', 'log', 'exp'] as const;
const MATH_VAR_SKIP = new Set(['sin', 'cos', 'tan', 'ln', 'log', 'exp', 'sqrt', 'frac', 'left', 'right']);

/** Symbols / letters found on the scanned formula sheet for the on-screen math keyboard. */
export function collectMathKeyboardAtoms(texts: string[]): string[] {
  const joined = texts.filter(Boolean).join(' \n ');
  const atoms = new Set<string>();

  for (const fn of MATH_FN_KEYS) {
    if (new RegExp(`\\\\?${fn}\\b`, 'i').test(joined)) atoms.add(fn);
  }

  for (const m of joined.matchAll(/\\([A-Za-z]+)/g)) {
    const cmd = m[1]!.toLowerCase();
    if (MATH_FN_KEYS.includes(cmd as (typeof MATH_FN_KEYS)[number])) atoms.add(cmd);
  }

  for (const m of joined.matchAll(/[A-Za-z]+/g)) {
    const w = m[0]!.toLowerCase();
    if (w.length === 1 && !MATH_VAR_SKIP.has(w)) atoms.add(w);
  }

  if (atoms.size === 0) atoms.add('x');
  return [...atoms].sort((a, b) => a.localeCompare(b));
}
