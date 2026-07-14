import { lookupLoanwordGloss } from './loanwordGlosses';
import type { WordPair } from '../types';

const TITLE_FRAGMENT = /^(vocabulaire|quelques mots|dans la (lan|langue)|liste de|un peu de)\b/i;

function detectLangSimple(text: string): 'nl' | 'fr' | 'en' | 'unknown' {
  if (/[àâäéèêëïîôùûüç]|(tion|ment|eau)\b/i.test(text)) return 'fr';
  if (/\w+(lijk|heid|isch)\b/i.test(text)) return 'nl';
  if (/\b(the|and|with)\b/i.test(text)) return 'en';
  return 'unknown';
}

export function isSpellingHintDefinition(definition: string): boolean {
  const d = definition.trim();
  if (!d) return true;
  if (/^…/.test(d) || /^\.{2,}/.test(d)) return true;
  if (/^mot\s*[·•]\s*\d+\s*lettres?$/i.test(d)) return true;
  return d === 'Mot à retenir';
}

/** Chapter / section heading — not a vocabulary item. */
export function isSectionTitle(text: string): boolean {
  const t = text.trim();
  if (t.length < 4 || t.length > 72) return false;
  if (/^(les|the)\s+(conjonctions|verbes|adjectifs|prépositions|prepositions|mots|coordination)\b/i.test(t)) {
    return true;
  }
  if (/^(le|la|les|het|de|l')\s+[A-ZÀ-Ÿ][\wàâäéèêëïîôùûüç'-]*(\s+[A-Za-zàâäéèêëïîôùûüç'-]+){0,4}$/.test(t)) {
    return true;
  }
  if (/^(le|la|les)\s+r[eè]gne\b/i.test(t)) return true;
  if (/^woordenschat\b/i.test(t)) return true;
  if (/^vocabulaire\b/i.test(t) && t.split(/\s+/).length <= 6) return true;
  return false;
}

export function isExampleSentence(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (/[.?!?,;:]/.test(t) && words.length >= 3) return true;
  if (
    words.length >= 4 &&
    /\b(ik|je|jij|wij|zij|het|is|are|the|we|they|nous|vous|il|elle|tu|dan|als|maar|want|niet|heb|ben|eet|drink|wil|gaat|blijf|regent|kom|komt)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

export function isGarbageVocabTerm(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 2) return true;
  if (TITLE_FRAGMENT.test(t)) return true;
  if (isSectionTitle(t)) return true;
  const low = t.toLowerCase();
  if (/^dans la (lan|langue)/.test(low)) return true;
  if (/^quelques mots/.test(low)) return true;
  if (/^(dans|les|des|une|the)\s+(la\s+)?(lan|langue)/.test(low)) return true;
  if (/^…/.test(t)) return true;
  if (isSpellingHintDefinition(t)) return true;
  if (/^[a-zà-]{1,5}\)$/i.test(t)) return true;
  if (/\)\s*$/.test(t) && !/\(/.test(t)) return true;
  if (
    /^[a-z]{1,2}\s+[a-zà-]/i.test(t) &&
    t.length <= 14 &&
    !/^(de|het|een|le|la|les|un|une|du|des|au|en|te|om|op|il|je|tu)\s+/i.test(t)
  ) {
    return true;
  }
  if (/^[a-z]{1,3}\s+animal$/i.test(t)) return true;
  return false;
}

function hasDutchArticle(text: string): boolean {
  return /\b(de|het|een)\s+\S/i.test(text) || /\(\s*(de|het)\s*\)/i.test(text);
}

function hasFrenchArticle(text: string): boolean {
  return /\b(l['']|le|la|les|un|une|des|du|au|aux)\s+\S/i.test(text);
}

function isLikelyTranslationPair(term: string, definition: string): boolean {
  if (lookupLoanwordGloss(term) && lookupLoanwordGloss(definition)) return false;

  if (hasDutchArticle(term) && hasFrenchArticle(definition)) return true;
  if (hasFrenchArticle(term) && hasDutchArticle(definition)) return true;

  const termNl = /\w+(lijk|heid)\b|\(\s*(de|het)\s*\)/i.test(term);
  const termFr = /[àâäéèêëïîôùûüç]|(tion|ment)\b/i.test(term);
  const defNl = /\w+(lijk|heid)\b|\(\s*(de|het)\s*\)/i.test(definition);
  const defFr = /[àâäéèêëïîôùûüç]|(tion|ment)\b/i.test(definition);

  if (termNl && defFr) return true;
  if (termFr && defNl) return true;

  const tl = detectLangSimple(term);
  const dl = detectLangSimple(definition);
  if (tl !== 'unknown' && dl !== 'unknown' && tl !== dl) return true;

  if ((termFr || defFr) && !lookupLoanwordGloss(term)) return true;

  if (
    /^[a-zàâäéèêëïîôùûüç'()-]{3,14}$/i.test(term) &&
    /^[a-zàâäéèêëïîôùûüç'()-]{3,16}$/i.test(definition) &&
    term.toLowerCase() !== definition.toLowerCase() &&
    !lookupLoanwordGloss(term) &&
    !lookupLoanwordGloss(definition)
  ) {
    return true;
  }

  return false;
}

/** Definition usable in quiz, vrai/faux, match — not a suffix hint or second column word. */
export function isPlayableDefinition(definition: string, term: string): boolean {
  if (isSpellingHintDefinition(definition)) return false;
  if (isGarbageVocabTerm(definition)) return false;

  const def = definition.trim();
  const defWords = def.split(/\s+/).length;
  const termWords = term.trim().split(/\s+/).length;

  if (defWords >= 2 || def.length >= 14) return true;
  if (lookupLoanwordGloss(term) && defWords >= 2) return true;

  if (
    looksLikeStandaloneVocabWord(term) &&
    looksLikeStandaloneVocabWord(def) &&
    termWords <= 2 &&
    defWords <= 2
  ) {
    return isLikelyTranslationPair(term, def);
  }

  return defWords >= 2;
}

/** Vrai/Faux needs real cross-language translation pairs with distinct answers. */
export function isTrueFalseSuitable(pairs: WordPair[]): boolean {
  if (pairs.length < 3) return false;

  const candidates = pairs.filter(
    (p) =>
      !isGarbageVocabTerm(p.term) &&
      !isGarbageVocabTerm(p.definition) &&
      !isSectionTitle(p.term) &&
      !isSectionTitle(p.definition) &&
      !isExampleSentence(p.term) &&
      !isExampleSentence(p.definition) &&
      isPlayableDefinition(p.definition, p.term) &&
      isLikelyTranslationPair(p.term, p.definition),
  );

  if (candidates.length < 3) return false;

  const uniqueDefs = new Set(candidates.map((p) => p.definition.toLowerCase().trim()));
  const uniqueTerms = new Set(candidates.map((p) => p.term.toLowerCase().trim()));
  return uniqueDefs.size >= 3 && uniqueTerms.size >= 3;
}

export function looksLikeStandaloneVocabWord(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 32 || isGarbageVocabTerm(t)) return false;
  if (isSpellingHintDefinition(t)) return false;
  return t.split(/\s+/).length <= 2;
}

export function enrichPairWithGloss(pair: WordPair): WordPair | null {
  if (isGarbageVocabTerm(pair.term)) return null;
  if (isSectionTitle(pair.term) || isSectionTitle(pair.definition)) return null;
  if (isExampleSentence(pair.term)) return null;
  if (isExampleSentence(pair.definition) && pair.definition.split(/\s+/).length >= 4) return null;

  const gloss = lookupLoanwordGloss(pair.term);
  const wrongColumnPair =
    looksLikeStandaloneVocabWord(pair.term) &&
    looksLikeStandaloneVocabWord(pair.definition) &&
    !isLikelyTranslationPair(pair.term, pair.definition);

  if (wrongColumnPair && gloss) {
    return { ...pair, definition: gloss, defLang: 'fr' };
  }

  if (isPlayableDefinition(pair.definition, pair.term)) return pair;
  if (!gloss) return null;

  return { ...pair, definition: gloss, defLang: 'fr' };
}

export function enrichTeachablePairs(pairs: WordPair[]): WordPair[] {
  const out: WordPair[] = [];
  const seen = new Set<string>();

  for (const pair of pairs) {
    const enriched = enrichPairWithGloss(pair);
    if (!enriched) continue;
    const key = enriched.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(enriched);
  }

  return out;
}
