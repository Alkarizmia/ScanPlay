import { useMemo } from 'react';
import katex from 'katex';
import { shouldRenderLatex, unwrapLatexDelimiters } from '../lib/mathText';

interface FormulaTextProps {
  text: string;
  className?: string;
  as?: 'span' | 'p' | 'h2';
}

export function FormulaText({ text, className, as = 'span' }: FormulaTextProps) {
  const Tag = as;
  const html = useMemo(() => {
    if (!shouldRenderLatex(text)) return null;
    try {
      return katex.renderToString(unwrapLatexDelimiters(text), {
        throwOnError: false,
        displayMode: false,
        output: 'html',
        strict: 'ignore',
      });
    } catch {
      return null;
    }
  }, [text]);

  if (html) {
    return <Tag className={`formula-text ${className ?? ''}`.trim()} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <Tag className={className}>{text}</Tag>;
}
