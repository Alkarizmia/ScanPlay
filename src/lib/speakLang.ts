import type { LangCode, WordPair } from '../types';
import { detectLang } from './columnParser';

/** Langue cible pour prononcer / écouter le terme (pas la traduction). */
export function resolveSpeakLang(pair: WordPair): LangCode {
  if (pair.termLang && pair.termLang !== 'unknown') return pair.termLang;

  const fromTerm = detectLang(pair.term);
  if (fromTerm !== 'unknown') return fromTerm;

  const defLang = pair.defLang;
  if (defLang === 'fr') return 'nl';
  if (defLang === 'nl') return 'fr';
  if (defLang === 'en') return 'en';

  const fromDef = detectLang(pair.definition);
  if (fromDef === 'fr') return 'nl';
  if (fromDef === 'nl') return 'fr';
  if (fromDef === 'en') return 'en';

  return 'unknown';
}
