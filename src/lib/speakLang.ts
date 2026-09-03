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

export function resolveSideLang(pair: WordPair, side: 'term' | 'def'): LangCode {
  if (side === 'term') return resolveSpeakLang(pair);

  if (pair.defLang && pair.defLang !== 'unknown') return pair.defLang;
  const fromDef = detectLang(pair.definition);
  if (fromDef !== 'unknown') return fromDef;

  const termLang = resolveSpeakLang(pair);
  if (termLang === 'fr') return 'nl';
  if (termLang === 'nl') return 'fr';
  if (termLang === 'en') return 'fr';
  return 'unknown';
}

/** True when the scanned pair is two different languages (vocab, not a monolingual note). */
export function pairHasDistinctLangs(pair: WordPair): boolean {
  const termLang = resolveSideLang(pair, 'term');
  const defLang = resolveSideLang(pair, 'def');
  if (termLang !== 'unknown' && defLang !== 'unknown') return termLang !== defLang;
  const term = pair.term.trim().toLowerCase();
  const def = pair.definition.trim().toLowerCase();
  return Boolean(term && def && term !== def);
}
